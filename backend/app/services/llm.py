import re
import json
import math
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from app.services.vectorstore import (
    search_lecture_chunks,
    get_genai_client,
    _chroma_client,
    get_collection_name,
)
from app.services.transcript import extract_video_id

load_dotenv()

# We use gemini-3.5-flash-lite for ultra-fast, low-latency, and grounded responses
LLM_MODEL = "gemini-3.5-flash-lite"

# --- Embedding-based Semantic Router for "Explain Differently" ---
# Pre-defined example phrases for each mode (Hindi, English, Hinglish mix)
# These are embedded once at startup and cached in memory
EXPLANATION_STYLE_EXAMPLES = {
    "analogy": [
        "explain using an analogy",
        "give me a real world analogy",
        "compare this to something in daily life",
        "kahani ke through samjhao",
        "kisi cheez se milake batao",
        "real life example se compare karo",
        "use an analogy to explain",
        "daily life analogy do",
        "rozkana example se samjhao",
        "jaise koi real world example ho",
    ],
    "simple": [
        "explain in simple language",
        "aasan bhasha mein batao",
        "bilkul basic level par samjhao",
        "ELI5",
        "explain like i'm 5",
        "jargon mat use karo",
        "seedhe shabdon mein samjhao",
        "plain english mein batao",
        "short mein samjhao",
        "samajh aane layak simple words mein",
    ],
    "example": [
        "give me a worked example",
        "step by step calculation dikhao",
        "numbers daal ke solve karke dikhao",
        "ek solved example do",
        "step by step calculate karo",
        "concrete example chahiye",
        "math example dekhna hai",
        "walk through an example",
        "solve karke batao",
        "ek example se samjhao",
    ],
    "alternative": [
        "explain it another way",
        "dusre tareeke se samjhao",
        "doosre tareeke se batao",
        "explain differently",
        "mere upar se gaya",
        "samajh nahi aaya",
        "not clear, explain again",
        "koi aur tareeka batao",
        "alternate explanation chahiye",
        "phir se samjhao alag se",
        "kuch aur bhasha mein batao",
    ],
}

# In-memory cache for pre-computed embeddings
_EMBEDDING_CACHE: Dict[str, List[List[float]]] = {}
_ROUTER_INITIALIZED = False
_SEMANTIC_THRESHOLD = 0.75  # Cosine similarity threshold


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def initialize_semantic_router():
    """
    Pre-compute embeddings for all example phrases at startup.
    Uses RETRIEVAL_DOCUMENT task type (same as lecture chunks).
    """
    global _EMBEDDING_CACHE, _ROUTER_INITIALIZED
    if _ROUTER_INITIALIZED:
        return

    client = get_genai_client()
    from google.genai import types

    for mode, phrases in EXPLANATION_STYLE_EXAMPLES.items():
        embeddings = []
        for phrase in phrases:
            try:
                res = client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=phrase,
                    config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
                )
                embeddings.append(res.embeddings[0].values)
            except Exception:
                # If any single phrase fails, we still continue
                pass
        _EMBEDDING_CACHE[mode] = embeddings

    _ROUTER_INITIALIZED = True
    print(f"[Semantic Router] Initialized with {sum(len(v) for v in _EMBEDDING_CACHE.values())} total example embeddings across {len(_EMBEDDING_CACHE)} modes.")


def detect_explanation_style_semantic(question: str) -> str:
    """
    Embedding-based intent detection for "explain differently" modes.
    Returns: 'analogy' | 'simple' | 'example' | 'alternative' | 'standard'
    """
    # Ensure router is initialized
    if not _ROUTER_INITIALIZED:
        initialize_semantic_router()

    # Embed the user's question (RETRIEVAL_QUERY for asymmetric matching)
    client = get_genai_client()
    from google.genai import types
    try:
        res = client.models.embed_content(
            model="gemini-embedding-001",
            contents=question,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY"),
        )
        query_embedding = res.embeddings[0].values
    except Exception:
        # Fallback to keyword-based if embedding fails
        return detect_explanation_style(question)

    # Compute max cosine similarity per mode
    best_mode = "standard"
    best_score = 0.0

    for mode, mode_embeddings in _EMBEDDING_CACHE.items():
        if not mode_embeddings:
            continue
        # Score = max similarity to any example in this mode
        mode_max_score = max(_cosine_similarity(query_embedding, ex_emb) for ex_emb in mode_embeddings)
        if mode_max_score > best_score:
            best_score = mode_max_score
            best_mode = mode

    # Only activate if score exceeds threshold
    if best_score >= _SEMANTIC_THRESHOLD:
        return best_mode

    return "standard"


def timestamp_to_seconds(ts_str: str) -> float:
    """Converts 'MM:SS' or 'HH:MM:SS' string into float seconds for player.seekTo()."""
    parts = [int(p) for p in ts_str.split(":")]
    if len(parts) == 3:
        return float(parts[0] * 3600 + parts[1] * 60 + parts[2])
    elif len(parts) == 2:
        return float(parts[0] * 60 + parts[1])
    return 0.0


def extract_citations(answer: str, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Parses all inline [MM:SS] citation badges from the LLM answer,
    maps each to exact video seconds, and attaches the matching lecture snippet.
    """
    pattern = r"\[(\d{1,2}:\d{2}(?::\d{2})?)\]"
    found = re.findall(pattern, answer)

    citations = []
    seen = set()

    for ts in found:
        if ts in seen:
            continue
        seen.add(ts)
        sec = timestamp_to_seconds(ts)

        # Match with chunk that has this start timestamp, or closest chunk
        matching_chunk = next((c for c in chunks if c.get("start_formatted") == ts), None)
        if not matching_chunk and chunks:
            matching_chunk = min(chunks, key=lambda c: abs(c.get("start", 0.0) - sec))

        snippet = (matching_chunk["text"][:120] + "...") if matching_chunk else ""
        citations.append({
            "timestamp_str": ts,
            "seconds": sec,
            "snippet": snippet,
        })

    return citations


def generate_with_fallback(
    contents: str,
    system_instruction: Optional[str] = None,
    response_mime_type: Optional[str] = None,
) -> str:
    """
    Calls Gemini with automatic failover across models if a temporary 503 spike occurs.
    Fallback cascade: gemini-3.5-flash-lite -> gemini-3.5-flash -> gemini-3.8-flash
    """
    client = get_genai_client()
    config = {}
    if system_instruction:
        config["system_instruction"] = system_instruction
    if response_mime_type:
        config["response_mime_type"] = response_mime_type

    models = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash"]
    last_err = None

    for m in models:
        try:
            res = client.models.generate_content(
                model=m,
                contents=contents,
                config=config,
            )
            return res.text.strip()
        except Exception as e:
            last_err = e
            continue

    raise RuntimeError(f"All Gemini generation models failed: {str(last_err)}")


def detect_explanation_style(question: str) -> str:
    """
    Detects if the student is asking to explain the concept differently.
    Returns: 'analogy' | 'simple' | 'example' | 'alternative' | 'standard'
    """
    q = question.lower()

    # 1. Analogy triggers
    if any(k in q for k in [
        "analogy", "real world", "story", "kahani", "compare", "tulna",
        "daily life", "rozkana", "jaise koi", "kisi cheez se"
    ]):
        return "analogy"

    # 2. Simple / ELIF5 triggers
    if any(k in q for k in [
        "simple", "aasan", "saral", "easy language", "layman", "5 year old",
        "bacchon ki tarah", "seedhe shabdon", "plain english", "short mein",
        "samajh aane layak"
    ]):
        return "simple"

    # 3. Worked Example triggers
    if any(k in q for k in [
        "worked example", "step by step", "calculation", "numbers ke sath",
        "math example", "concrete example", "ek example", "solve karke"
    ]):
        return "example"

    # 4. General "explain differently" triggers
    if any(k in q for k in [
        "dusre tareeke", "doosre tareeke", "differently", "another way", "phir se samjhao",
        "samajh nahi aaya", "not clear", "koi aur tareeka", "alternate", "kuch aur bhasha"
    ]):
        return "alternative"

    return "standard"


def answer_lecture_question(
    video_id: str,
    question: str,
    current_time: Optional[float] = None,
    language: str = "en",
    chat_history: Optional[List[Dict[str, str]]] = None,
    top_k: int = 4,
) -> Dict[str, Any]:
    """
    Core RAG Chat pipeline:
    1. Retrieve relevant lecture chunks from ChromaDB.
    2. (Optional) Apply proximity boost if student is asking at a specific video timestamp.
    3. Build grounded prompt with instructions & citations syntax.
    4. Call Gemini to generate the answer.
    5. Parse clickable citations with timestamps.
    """
    # 1. Retrieve top chunks from ChromaDB
    chunks = search_lecture_chunks(video_id=video_id, query=question, top_k=top_k + 2)

    if not chunks:
        return {
            "answer": "This lecture does not appear to be indexed yet. Please process the video first.",
            "citations": [],
            "sources": [],
            "language": language,
        }

    # 2. Context-aware proximity boost (if Arjun is asking while watching at current_time)
    if current_time is not None:
        for c in chunks:
            # If chunk is within 120 seconds of where Arjun is currently watching, give a 0.07 boost
            time_diff = abs(c["start"] - current_time)
            if time_diff <= 120.0:
                c["similarity_score"] = round(c["similarity_score"] + 0.07, 4)

        # Re-sort by boosted score and take top_k
        chunks.sort(key=lambda x: x["similarity_score"], reverse=True)

    selected_chunks = chunks[:top_k]

    # Format transcript blocks for the prompt
    context_blocks = []
    for c in selected_chunks:
        context_blocks.append(
            f"[{c['start_formatted']}] (Start: {c['start']}s - End: {c['end']}s)\n{c['text']}"
        )
    context_text = "\n\n".join(context_blocks)

    # 3. Language customization
    lang_instruction = "Respond in clear, encouraging English suitable for an undergraduate student."
    if language.lower() in ["hinglish", "hi-latn"]:
        lang_instruction = (
            "Respond in friendly, natural Hinglish (Hindi written in Latin/English alphabet), "
            "as spoken by top Indian coding and engineering educators (e.g. 'Arre dost, polymers "
            "basically long chains hote hain...'). Keep technical terms in English."
        )
    elif language.lower() in ["hi", "hindi"]:
        lang_instruction = "Respond in clean, natural Hindi (Devanagari script) with core technical terms clearly explained."

    # 4. Pedagogical Explanation Mode ("Explain Differently")
    # Use semantic router (embedding-based) as primary, keyword as fallback
    style = detect_explanation_style_semantic(question)
    style_instruction = ""
    if style == "analogy":
        style_instruction = (
            "\nPEDAGOGICAL INSTRUCTION (ANALOGY MODE): The student wants an intuitive, relatable analogy. "
            "Explain using an everyday real-world analogy (e.g. dimmer switches, volume knobs, factory workers, filters). "
            "Directly map each element of the analogy back to the lecture transcript and cite timestamps."
        )
    elif style == "simple":
        style_instruction = (
            "\nPEDAGOGICAL INSTRUCTION (SIMPLE / NO-JARGON MODE): The student wants an ultra-simple explanation. "
            "Strip away intimidating academic jargon and explain step-by-step using plain, intuitive words, "
            "while remaining strictly grounded in the instructor's words with citations."
        )
    elif style == "example":
        style_instruction = (
            "\nPEDAGOGICAL INSTRUCTION (WORKED EXAMPLE MODE): The student wants a concrete worked example. "
            "Walk through a simple step-by-step numerical illustration (using small numbers like 0.8, -10, etc.) "
            "demonstrating the exact formula or logic the instructor described, citing timestamps."
        )
    elif style == "alternative":
        style_instruction = (
            "\nPEDAGOGICAL INSTRUCTION (ALTERNATIVE PERSPECTIVE): The student did not understand the standard explanation. "
            "Explain the concept from a completely fresh angle or mental model, emphasizing the intuitive 'why' "
            "before the technical 'how', citing timestamps."
        )

    # 5. Construct System & User Prompt
    system_instruction = f"""You are an expert AI pair-tutor assisting a student watching an online video lecture.
Your duty is to clarify doubts and explain concepts GROUNDED STRICTLY in what the instructor taught.

CRITICAL RULES:
1. STRICT GROUNDING: Answer ONLY based on the provided Transcript Context. If the concept was NOT taught in the lecture, explicitly state: 'The instructor did not cover this in the lecture.' Do not hallucinate outside information.
2. CLICKABLE CITATIONS: Every key explanation, definition, or fact MUST cite the exact timestamp in the format [{'{MM:SS}'}] (e.g. [03:25]). Use ONLY the timestamps present in the provided context.
3. LANGUAGE: {lang_instruction}
4. TONE: Warm, encouraging, concise, and focused on helping the student truly understand.{style_instruction}"""

    # Format conversation history if provided
    history_text = ""
    if chat_history:
        formatted_turns = []
        for turn in chat_history[-4:]:  # Keep last 4 turns for context window efficiency
            role = "Student" if turn.get("role") == "user" else "Tutor"
            content = turn.get("content", "").strip()
            formatted_turns.append(f"{role}: {content}")
        if formatted_turns:
            history_text = "Recent Conversation History:\n" + "\n".join(formatted_turns) + "\n\n"

    user_prompt = f"""Transcript Context from Lecture:
\"\"\"
{context_text}
\"\"\"

{history_text}Student's Doubt:
{question}

Answer (with exact [MM:SS] timestamp citations):"""

    # 5. Call Gemini with automatic fallback
    answer_text = generate_with_fallback(
        contents=user_prompt,
        system_instruction=system_instruction,
    )

    # 6. Extract clickable citations
    citations = extract_citations(answer_text, selected_chunks)

    return {
        "answer": answer_text,
        "citations": citations,
        "sources": selected_chunks,
        "language": language,
    }


def get_all_lecture_chunks(video_id: str) -> List[Dict[str, Any]]:
    """Retrieves all indexed chunks for a video from ChromaDB in chronological order."""
    collection_name = get_collection_name(video_id)
    try:
        col = _chroma_client.get_collection(collection_name)
    except Exception:
        raise RuntimeError(f"Lecture '{video_id}' has not been indexed yet. Please load the video first.")

    res = col.get()
    chunks = []
    for doc, meta in zip(res["documents"], res["metadatas"]):
        chunks.append({
            "text": doc,
            "start": float(meta["start"]),
            "end": float(meta["end"]),
            "start_formatted": meta["start_formatted"],
            "end_formatted": meta["end_formatted"],
        })

    # Sort chronologically
    chunks.sort(key=lambda x: x["start"])
    return chunks


def generate_lecture_notes(video_id_or_url: str, language: str = "hinglish") -> Dict[str, Any]:
    """Generates structured revision notes broken down into topics with clickable timestamp bounds."""
    video_id = extract_video_id(video_id_or_url)
    chunks = get_all_lecture_chunks(video_id)

    # Format transcript summary
    transcript_text = "\n\n".join(
        f"[{c['start_formatted']} - {c['end_formatted']}] {c['text']}" for c in chunks
    )

    lang_instruction = "in clear English"
    if language.lower() in ["hinglish", "hi-latn"]:
        lang_instruction = "in engaging Hinglish (Hindi in Latin script, technical terms in English)"
    elif language.lower() in ["hi", "hindi"]:
        lang_instruction = "in formal Hindi (Devanagari)"

    prompt = f"""You are a master academic notes creator. Create structured, high-yield revision notes from the following lecture transcript.
Language: Write the explanations {lang_instruction}.

Rules:
1. Divide the lecture into 3-6 logical core conceptual topics.
2. For each topic, give an accurate start and end timestamp matching the timestamps in the transcript.
3. Include 2-4 high-yield bullet points under summary_points.
4. Include a 1-sentence 'key_takeaway'.
5. Output pure JSON matching the requested schema.

Transcript:
\"\"\"
{transcript_text}
\"\"\"

Output format:
{{
  "topics": [
    {{
      "title": "Topic Title",
      "timestamp_str": "03:25",
      "start": 205.0,
      "end": 350.0,
      "summary_points": ["bullet 1", "bullet 2"],
      "key_takeaway": "one sentence summary"
    }}
  ]
}}"""

    try:
        raw_json = generate_with_fallback(
            contents=prompt,
            response_mime_type="application/json",
        )
        data = json.loads(raw_json)
        return {
            "video_id": video_id,
            "topics": data.get("topics", []),
            "language": language,
        }
    except Exception as e:
        raise RuntimeError(f"Failed to generate notes: {str(e)}")


def generate_lecture_quiz(
    video_id_or_url: str,
    language: str = "hinglish",
    num_questions: int = 4,
) -> Dict[str, Any]:
    """Generates an active recall quiz with 4 options, explanations, and exact video timestamp citations."""
    video_id = extract_video_id(video_id_or_url)
    chunks = get_all_lecture_chunks(video_id)

    transcript_text = "\n\n".join(
        f"[{c['start_formatted']} - {c['end_formatted']}] {c['text']}" for c in chunks
    )

    lang_instruction = "in clear English"
    if language.lower() in ["hinglish", "hi-latn"]:
        lang_instruction = "in natural Hinglish (questions & explanations in conversational Hinglish)"
    elif language.lower() in ["hi", "hindi"]:
        lang_instruction = "in Hindi"

    prompt = f"""You are an expert exam creator. Create {num_questions} conceptual, thought-provoking multiple choice questions to test student mastery of this lecture.
Language: {lang_instruction}.

Rules:
1. Questions must test true conceptual understanding, not trivial word-memorization.
2. Provide exactly 4 options per question.
3. correct_index must be the integer 0, 1, 2, or 3.
4. explanation must explain WHY that option is right and cite what the instructor said.
5. timestamp_str and timestamp_seconds must point to the exact moment in the lecture where this concept was explained.
6. Output pure JSON matching the schema.

Transcript:
\"\"\"
{transcript_text}
\"\"\"

Output format:
{{
  "questions": [
    {{
      "id": 1,
      "question": "Question text...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Explanation...",
      "timestamp_str": "03:25",
      "timestamp_seconds": 205.0
    }}
  ]
}}"""

    try:
        raw_json = generate_with_fallback(
            contents=prompt,
            response_mime_type="application/json",
        )
        data = json.loads(raw_json)
        return {
            "video_id": video_id,
            "questions": data.get("questions", []),
            "language": language,
        }
    except Exception as e:
        raise RuntimeError(f"Failed to generate quiz: {str(e)}")

