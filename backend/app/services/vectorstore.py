import os
from typing import List, Dict, Any, Optional

import chromadb
from google import genai
from dotenv import load_dotenv

from app.services.chunker import chunk_transcript
from app.services.transcript import fetch_transcript, extract_video_id

# Load environment variables
load_dotenv()

# ---------------------------------------------------------------------------
# ChromaDB setup
#
# Priority:
#   1. Chroma Cloud  (set CHROMA_API_KEY, CHROMA_TENANT, CHROMA_DATABASE)
#      -> data persists, works on Vercel.
#   2. Vercel without Chroma Cloud -> /tmp/chroma (only writable folder on
#      Vercel; data is temporary and may vanish on cold starts).
#   3. Local development -> backend/data/chroma (persistent on disk).
#
# The client is created lazily (on first use) so that importing this module
# can never crash the whole server at startup.
# ---------------------------------------------------------------------------
_chroma_client: Optional[Any] = None


def _local_chroma_dir() -> str:
    if os.getenv("VERCEL"):
        return "/tmp/chroma"
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        "data",
        "chroma",
    )


def get_chroma_client():
    """Returns or lazily initializes the ChromaDB client."""
    global _chroma_client
    if _chroma_client is not None:
        return _chroma_client

    api_key = os.getenv("CHROMA_API_KEY")
    tenant = os.getenv("CHROMA_TENANT")
    database = os.getenv("CHROMA_DATABASE")

    if api_key and tenant and database:
        _chroma_client = chromadb.CloudClient(
            tenant=tenant,
            database=database,
            api_key=api_key,
        )
    else:
        chroma_dir = _local_chroma_dir()
        os.makedirs(chroma_dir, exist_ok=True)
        _chroma_client = chromadb.PersistentClient(path=chroma_dir)

    return _chroma_client


def _get_or_create_collection(name: str):
    """Creates a cosine-distance collection, compatible with old and new Chroma."""
    client = get_chroma_client()
    try:
        # Newer Chroma versions
        return client.get_or_create_collection(
            name=name,
            configuration={"hnsw": {"space": "cosine"}},
        )
    except Exception:
        # Older versions
        return client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )


# ---------------------------------------------------------------------------
# Google GenAI setup
# ---------------------------------------------------------------------------
_genai_client: Optional[genai.Client] = None

# gemini-embedding-001 (dimension: 3072, high accuracy, multilingual)
EMBEDDING_MODEL = "gemini-embedding-001"


def get_genai_client() -> genai.Client:
    """Returns or lazily initializes the Google GenAI client."""
    global _genai_client
    if _genai_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY environment variable is not set. "
                "Please configure it in backend/.env or in Vercel settings."
            )
        _genai_client = genai.Client(api_key=api_key)
    return _genai_client


def get_collection_name(video_id: str) -> str:
    """Returns a sanitized collection name for a given YouTube video."""
    # Chroma collection names must be 3-63 chars, alphanumeric/underscore/hyphen
    sanitized = video_id.replace("-", "_")
    return f"lecture_{sanitized}"


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------
def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Computes vector embeddings for a list of text snippets using Gemini.
    Uses task_type='RETRIEVAL_DOCUMENT' for document-side retrieval.
    """
    client = get_genai_client()
    embeddings: List[List[float]] = []

    # Process in batches of 40 to stay well within API limits
    batch_size = 40
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=batch,
            config={"task_type": "RETRIEVAL_DOCUMENT"},
        )
        for emb in response.embeddings:
            embeddings.append(emb.values)

    return embeddings


def embed_query(query: str) -> List[float]:
    """
    Generates embedding for a single user query.
    Uses task_type='RETRIEVAL_QUERY' for query-side retrieval.
    """
    client = get_genai_client()
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=query,
        config={"task_type": "RETRIEVAL_QUERY"},
    )
    return response.embeddings[0].values


# ---------------------------------------------------------------------------
# Indexing
# ---------------------------------------------------------------------------
def index_lecture_chunks(video_id: str, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Indexes lecture chunks into a ChromaDB collection.
    If the collection already has chunks, re-embedding is skipped to save
    API tokens and time.
    """
    collection_name = get_collection_name(video_id)
    collection = _get_or_create_collection(collection_name)

    existing_count = collection.count()
    if existing_count > 0:
        return {
            "status": "already_indexed",
            "collection_name": collection_name,
            "total_chunks": existing_count,
            "message": f"Lecture '{video_id}' is already indexed with {existing_count} chunks.",
        }

    ids = [f"{video_id}_{c['chunk_id']}" for c in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = [
        {
            "chunk_id": c["chunk_id"],
            "video_id": video_id,
            "start": float(c["start"]),
            "end": float(c["end"]),
            "start_formatted": c["start_formatted"],
            "end_formatted": c["end_formatted"],
            "word_count": int(c["word_count"]),
        }
        for c in chunks
    ]

    embeddings = embed_texts(documents)

    # Insert in batches (Chroma Cloud limits how many records one call can add)
    batch_size = 100
    for i in range(0, len(ids), batch_size):
        collection.add(
            ids=ids[i : i + batch_size],
            embeddings=embeddings[i : i + batch_size],
            documents=documents[i : i + batch_size],
            metadatas=metadatas[i : i + batch_size],
        )

    return {
        "status": "indexed",
        "collection_name": collection_name,
        "total_chunks": len(chunks),
        "message": f"Successfully indexed {len(chunks)} chunks for lecture '{video_id}'.",
    }


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------
def search_lecture_chunks(
    video_id: str,
    query: str,
    top_k: int = 3,
) -> List[Dict[str, Any]]:
    """
    Searches the lecture's collection for the top_k most relevant chunks
    to the student's question.
    """
    collection_name = get_collection_name(video_id)
    try:
        collection = get_chroma_client().get_collection(name=collection_name)
    except Exception:
        raise RuntimeError(
            f"Lecture '{video_id}' has not been indexed yet. "
            "Please process/index the video first."
        )

    total = collection.count()
    if total == 0:
        raise RuntimeError(
            f"Lecture '{video_id}' has not been indexed yet. "
            "Please process/index the video first."
        )

    query_vector = embed_query(query)

    results = collection.query(
        query_embeddings=[query_vector],
        n_results=min(top_k, total),
    )

    search_items: List[Dict[str, Any]] = []
    if results and results.get("documents"):
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        distances = (
            results["distances"][0]
            if results.get("distances")
            else [0.0] * len(docs)
        )

        for doc, meta, dist in zip(docs, metas, distances):
            # In cosine space, similarity = 1 - cosine_distance
            similarity = round(max(0.0, 1.0 - float(dist)), 4)
            search_items.append(
                {
                    "chunk_id": meta.get("chunk_id"),
                    "text": doc,
                    "start": meta.get("start"),
                    "end": meta.get("end"),
                    "start_formatted": meta.get("start_formatted"),
                    "end_formatted": meta.get("end_formatted"),
                    "similarity_score": similarity,
                }
            )

    return search_items


# ---------------------------------------------------------------------------
# Full ingestion pipeline
# ---------------------------------------------------------------------------
def process_and_index_video(
    url_or_id: str,
    target_words: int = 180,
    overlap_words: int = 35,
) -> Dict[str, Any]:
    """
    Complete ingestion pipeline:
    1. Extract Video ID
    2. Fetch Transcript
    3. Smart Chunking
    4. Embed & Store in ChromaDB
    """
    video_id = extract_video_id(url_or_id)
    collection_name = get_collection_name(video_id)

    # Skip YouTube + embedding work if this lecture is already indexed
    try:
        collection = get_chroma_client().get_collection(name=collection_name)
        existing_count = collection.count()
        if existing_count > 0:
            return {
                "status": "already_indexed",
                "video_id": video_id,
                "collection_name": collection_name,
                "total_chunks": existing_count,
                "raw_snippets_count": existing_count,
                "message": f"Lecture '{video_id}' is already indexed with {existing_count} chunks.",
            }
    except Exception:
        pass

    raw_snippets = fetch_transcript(video_id)
    chunks = chunk_transcript(
        raw_snippets,
        target_words=target_words,
        overlap_words=overlap_words,
    )
    result = index_lecture_chunks(video_id, chunks)
    result["video_id"] = video_id
    result["raw_snippets_count"] = len(raw_snippets)
    return result