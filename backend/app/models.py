import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Float,
    UniqueConstraint,
)
from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)
    is_guest = Column(Boolean, default=False, nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class UserLecture(Base):
    """Tracks lectures loaded/studied by each authenticated student."""
    __tablename__ = "user_lectures"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    video_id = Column(String(64), nullable=False, index=True)
    video_url = Column(String(512), nullable=True)
    title = Column(String(255), nullable=True)
    last_accessed_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "video_id", name="uq_user_video"),
    )


class UserQuestion(Base):
    """Persists questions asked by students with AI answers and timestamp citations for revision."""
    __tablename__ = "user_questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    video_id = Column(String(64), nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    citations_json = Column(Text, nullable=True)  # JSON-encoded citations list
    playback_time = Column(Float, nullable=True)
    language = Column(String(32), default="hinglish", nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
