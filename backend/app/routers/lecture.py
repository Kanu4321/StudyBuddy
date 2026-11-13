import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User, UserLecture, UserQuestion
from app.auth import get_current_user
from app.schemas.lecture import (
    TranscriptRequest,
    TranscriptResponse,
    TranscriptItem,
    ChunkRequest,
    ChunkResponse,
    ChunkItem,
    ProcessVideoRequest,
    ProcessVideoResponse,
    SearchLectureRequest,
    SearchLectureResponse,
    SearchResultItem,
    ChatRequest,
    ChatResponse,
    CitationItem,
    NotesRequest,
    NotesResponse,
    QuizRequest,
    QuizResponse,
)
from app.services.transcript import fetch_transcript, extract_video_id, format_timestamp
from app.services.chunker import chunk_transcript
from app.services.vectorstore import (
    process_and_index_video,
    search_lecture_chunks,
)
from app.services.llm import (
    answer_lecture_question,
    generate_lecture_notes,
    generate_lecture_quiz,
)

router = APIRouter(
    prefix="/api",
    tags=["Lecture"],
    dependencies=[Depends(get_current_user)],
)


@router.post(
    "/transcript",
    response_model=TranscriptResponse,
    summary="Fetch timestamped transcript from YouTube",
    description="Given a YouTube URL or video ID, returns all spoken captions with exact start and end seconds.",
)
def get_transcript_endpoint(payload: TranscriptRequest):
    try:
        video_id = extract_video_id(payload.url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    try:
        snippets = fetch_transcript(video_id)
        total_duration = snippets[-1]["end"] if snippets else 0.0

        transcript_items = [TranscriptItem(**item) for item in snippets]

        return TranscriptResponse(
            video_id=video_id,
            total_snippets=len(transcript_items),
            duration_seconds=total_duration,
            duration_formatted=format_timestamp(total_duration),
            transcript=transcript_items,
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}",
        )


@router.post(
    "/chunk",
    response_model=ChunkResponse,
    summary="Fetch transcript and group into semantic chunks",
    description="Groups fine-grained subtitles into coherent paragraph chunks with preserved start and end timestamps.",
)
def chunk_transcript_endpoint(payload: ChunkRequest):
    try:
        video_id = extract_video_id(payload.url)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    try:
        raw_snippets = fetch_transcript(video_id)
        chunks = chunk_transcript(
            raw_snippets,
            target_words=payload.target_words,
            overlap_words=payload.overlap_words,
        )

        chunk_items = [ChunkItem(**c) for c in chunks]

        return ChunkResponse(
            video_id=video_id,
            total_raw_snippets=len(raw_snippets),
            total_chunks=len(chunk_items),
            target_words=payload.target_words,
            overlap_words=payload.overlap_words,
            chunks=chunk_items,
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}",
        )


@router.post(
    "/process",
    response_model=ProcessVideoResponse,
    summary="Process & Index YouTube video into Vector Database",
    description="Downloads transcript, groups into smart chunks, generates embeddings, and persists in ChromaDB.",
)
def process_video_endpoint(
    payload: ProcessVideoRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = process_and_index_video(
            url_or_id=payload.url,
            target_words=payload.target_words,
            overlap_words=payload.overlap_words,
        )

        # Track lecture in user's personalized watch history
        try:
            video_id = result.get("video_id")
            if video_id:
                user_lec = (
                    db.query(UserLecture)
                    .filter(UserLecture.user_id == current_user.id, UserLecture.video_id == video_id)
                    .first()
                )
                if user_lec:
                    user_lec.last_accessed_at = datetime.now(timezone.utc)
                    if payload.url:
                        user_lec.video_url = payload.url
                else:
                    user_lec = UserLecture(
                        user_id=current_user.id,
                        video_id=video_id,
                        video_url=payload.url,
                        title=f"Lecture ({video_id})",
                    )
                    db.add(user_lec)
                db.commit()
        except Exception as track_err:
            db.rollback()
            print(f"[Warning] Failed to track user lecture: {track_err}")

        return ProcessVideoResponse(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process video: {str(e)}",
        )


@router.post(
    "/search",
    response_model=SearchLectureResponse,
    summary="Search lecture chunks using semantic vector retrieval",
    description="Embeds the user's question and retrieves the top-k most semantically relevant chunks with timestamps.",
)
def search_lecture_endpoint(payload: SearchLectureRequest):
    try:
        video_id = extract_video_id(payload.url_or_video_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    try:
        raw_results = search_lecture_chunks(
            video_id=video_id,
            query=payload.query,
            top_k=payload.top_k,
        )
        items = [SearchResultItem(**r) for r in raw_results]

        return SearchLectureResponse(
            video_id=video_id,
            query=payload.query,
            results_count=len(items),
            results=items,
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}",
        )


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Ask a doubt about the lecture (RAG Q&A with timestamp citations)",
    description="Retrieves the most relevant lecture chunks and uses Gemini to answer grounded strictly in the transcript with clickable citations.",
)
def chat_endpoint(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        video_id = extract_video_id(payload.url_or_video_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    try:
        rag_result = answer_lecture_question(
            video_id=video_id,
            question=payload.question,
            current_time=payload.current_time,
            language=payload.language,
        )

        citations = [CitationItem(**c) for c in rag_result["citations"]]
        sources = [SearchResultItem(**s) for s in rag_result["sources"]]

        # Persist question and answer in user's personalized revision history
        try:
            user_question = UserQuestion(
                user_id=current_user.id,
                video_id=video_id,
                question=payload.question,
                answer=rag_result["answer"],
                citations_json=json.dumps([c.model_dump() for c in citations]),
                playback_time=payload.current_time,
                language=payload.language,
            )
            db.add(user_question)

            # Ensure lecture exists in UserLecture and update last_accessed_at
            user_lec = (
                db.query(UserLecture)
                .filter(UserLecture.user_id == current_user.id, UserLecture.video_id == video_id)
                .first()
            )
            if user_lec:
                user_lec.last_accessed_at = datetime.now(timezone.utc)
            else:
                user_lec = UserLecture(
                    user_id=current_user.id,
                    video_id=video_id,
                    video_url=f"https://www.youtube.com/watch?v={video_id}",
                    title=f"Lecture ({video_id})",
                )
                db.add(user_lec)

            db.commit()
        except Exception as q_err:
            db.rollback()
            print(f"[Warning] Failed to track user question: {q_err}")

        return ChatResponse(
            video_id=video_id,
            question=payload.question,
            answer=rag_result["answer"],
            citations=citations,
            sources=sources,
            language=rag_result["language"],
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate answer: {str(e)}",
        )


@router.post(
    "/notes",
    response_model=NotesResponse,
    summary="Generate structured revision notes with timestamp ranges",
    description="Analyzes full lecture transcript and creates structured topic summaries with jump bounds.",
)
def generate_notes_endpoint(payload: NotesRequest):
    try:
        data = generate_lecture_notes(
            video_id_or_url=payload.url_or_video_id,
            language=payload.language,
        )
        return NotesResponse(**data)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate notes: {str(e)}",
        )


@router.post(
    "/quiz",
    response_model=QuizResponse,
    summary="Generate conceptual mastery quiz with timestamp citations",
    description="Generates interactive multiple-choice questions grounded in the video with explanation and timestamp jumps.",
)
def generate_quiz_endpoint(payload: QuizRequest):
    try:
        data = generate_lecture_quiz(
            video_id_or_url=payload.url_or_video_id,
            language=payload.language,
            num_questions=payload.num_questions,
        )
        return QuizResponse(**data)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz: {str(e)}",
        )




