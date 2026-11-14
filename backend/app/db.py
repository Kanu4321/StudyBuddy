import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IS_VERCEL = bool(os.getenv("VERCEL"))

DATABASE_URL = os.getenv("DATABASE_URL")

# SQLAlchemy needs "postgresql://", but some providers give "postgres://"
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Fall back to SQLite only when no real database URL is configured
if not DATABASE_URL or DATABASE_URL == "sqlite:///./data/studybuddy.db":
    # Vercel's filesystem is read-only except /tmp (and /tmp data is temporary)
    DATA_DIR = "/tmp/data" if IS_VERCEL else os.path.join(BASE_DIR, "data")
    os.makedirs(DATA_DIR, exist_ok=True)
    sqlite_path = os.path.join(DATA_DIR, "studybuddy.db").replace("\\", "/")
    DATABASE_URL = f"sqlite:///{sqlite_path}"

is_sqlite = DATABASE_URL.startswith("sqlite")

if is_sqlite:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # NullPool suits serverless: each invocation opens/closes its own connection
    engine = create_engine(DATABASE_URL, poolclass=NullPool, pool_pre_ping=True)

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