import json
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db import get_db
from app.models import User, UserLecture, UserQuestion
from app.auth import get_current_user
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    WatchedLectureItem,
    QuestionRevisionItem,
)

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
    dependencies=[Depends(get_current_user)],
)


@router.get(
    "",
    response_model=DashboardSummaryResponse,
    summary="Get student revision dashboard summary",
    description="Returns list of lectures studied by the student and revision doubts they asked.",
)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Fetch user's watched lectures
    lectures = (
        db.query(UserLecture)
        .filter(UserLecture.user_id == current_user.id)
        .order_by(UserLecture.last_accessed_at.desc())
        .all()
    )

    watched_items: List[WatchedLectureItem] = []
    for lec in lectures:
        q_count = (
            db.query(func.count(UserQuestion.id))
            .filter(
                UserQuestion.user_id == current_user.id,
                UserQuestion.video_id == lec.video_id,
            )
            .scalar()
            or 0
        )
        watched_items.append(
            WatchedLectureItem(
                id=lec.id,
                video_id=lec.video_id,
                video_url=lec.video_url,
                title=lec.title or f"Lecture ({lec.video_id})",
                questions_count=q_count,
                last_accessed_at=lec.last_accessed_at,
                created_at=lec.created_at,
            )
        )

    # 2. Fetch total questions count
    total_questions = (
        db.query(func.count(UserQuestion.id))
        .filter(UserQuestion.user_id == current_user.id)
        .scalar()
        or 0
    )

    # 3. Fetch recent revision questions
    recent_db_questions = (
        db.query(UserQuestion)
        .filter(UserQuestion.user_id == current_user.id)
        .order_by(UserQuestion.created_at.desc())
        .limit(50)
        .all()
    )

    question_items: List[QuestionRevisionItem] = []
    for q in recent_db_questions:
        try:
            citations = json.loads(q.citations_json) if q.citations_json else []
        except Exception:
            citations = []

        question_items.append(
            QuestionRevisionItem(
                id=q.id,
                video_id=q.video_id,
                question=q.question,
                answer=q.answer,
                citations=citations,
                playback_time=q.playback_time,
                language=q.language,
                created_at=q.created_at,
            )
        )

    return DashboardSummaryResponse(
        total_lectures_watched=len(watched_items),
        total_questions_asked=total_questions,
        watched_lectures=watched_items,
        recent_questions=question_items,
    )


@router.get(
    "/questions",
    response_model=List[QuestionRevisionItem],
    summary="Get user's question history for revision",
)
def get_user_questions(
    video_id: Optional[str] = Query(None, description="Filter doubts by specific video ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(UserQuestion).filter(UserQuestion.user_id == current_user.id)
    if video_id:
        query = query.filter(UserQuestion.video_id == video_id)

    db_questions = query.order_by(UserQuestion.created_at.desc()).all()

    items: List[QuestionRevisionItem] = []
    for q in db_questions:
        try:
            citations = json.loads(q.citations_json) if q.citations_json else []
        except Exception:
            citations = []

        items.append(
            QuestionRevisionItem(
                id=q.id,
                video_id=q.video_id,
                question=q.question,
                answer=q.answer,
                citations=citations,
                playback_time=q.playback_time,
                language=q.language,
                created_at=q.created_at,
            )
        )
    return items
