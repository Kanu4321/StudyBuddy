from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel


class WatchedLectureItem(BaseModel):
    id: str
    video_id: str
    video_url: Optional[str] = None
    title: Optional[str] = None
    questions_count: int
    last_accessed_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionRevisionItem(BaseModel):
    id: str
    video_id: str
    question: str
    answer: str
    citations: List[Any]
    playback_time: Optional[float] = None
    language: str
    created_at: datetime


class DashboardSummaryResponse(BaseModel):
    total_lectures_watched: int
    total_questions_asked: int
    watched_lectures: List[WatchedLectureItem]
    recent_questions: List[QuestionRevisionItem]
