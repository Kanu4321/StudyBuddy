import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routers.lecture import router as lecture_router

# Load environment variables from .env file (e.g. GEMINI_API_KEY)
load_dotenv()

# Initialize FastAPI application
app = FastAPI(
    title="Video Lecture Assistant API",
    description="Backend API powering interactive, grounded lecture learning",
    version="0.1.0",
)

# Configure CORS (Cross-Origin Resource Sharing)
# This allows our React frontend (running on port 5173) to communicate with this backend (on port 8000).
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Origins allowed to make requests
    allow_credentials=True,     # Allow cookies and authorization headers
    allow_methods=["*"],        # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],        # Allow all headers
)

# Register routers
app.include_router(lecture_router)


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
