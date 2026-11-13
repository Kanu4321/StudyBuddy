import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.db import init_db
from app.routers.auth import router as auth_router
from app.routers.lecture import router as lecture_router
from app.routers.dashboard import router as dashboard_router

# Load environment variables from .env file (e.g. GEMINI_API_KEY, JWT_SECRET, DATABASE_URL)
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    init_db()
    yield


# Initialize FastAPI application
app = FastAPI(
    title="Video Lecture Assistant API",
    description="Backend API powering interactive, grounded lecture learning",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS (Cross-Origin Resource Sharing)
# This allows our React frontend (running on port 5173) to communicate with this backend (on port 8000).
# In production on Vercel, you should add your Vercel domain to this list.
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Allow origins from environment variable for production
if cors_origins := os.getenv("CORS_ORIGINS"):
    origins.extend([o.strip() for o in cors_origins.split(",")])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Origins allowed to make requests
    allow_credentials=True,     # Allow cookies and authorization headers
    allow_methods=["*"],        # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],        # Allow all headers including Authorization
)

# Register routers
app.include_router(auth_router)
app.include_router(lecture_router)
app.include_router(dashboard_router)


@app.get("/")
def read_root():
    """Root endpoint welcoming visitors and linking to documentation."""
    return {
        "message": "Welcome to the Video Lecture Assistant API",
        "docs_url": "/docs",
    }


@app.get("/api/health")
def health_check():
    """Health check endpoint to verify backend is up and running."""
    gemini_key_configured = bool(os.getenv("GEMINI_API_KEY"))
    return {
        "status": "ok",
        "gemini_api_key_set": gemini_key_configured,
        "message": "Backend service is operational",
    }