import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)
DEFAULT_SQLITE_PATH = os.path.join(DATA_DIR, "studybuddy.db").replace("\\", "/")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL or DATABASE_URL == "sqlite:///./data/studybuddy.db":
    DATABASE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables on startup."""
    from app import models  # noqa: F401 - ensure models are imported for table creation
    Base.metadata.create_all(bind=engine)