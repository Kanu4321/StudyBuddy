from typing import List, Optional
from pydantic import BaseModel, Field


class TranscriptItem(BaseModel):
    """Represents a single timestamped caption snippet."""
    text: str = Field(..., description="The spoken subtitle text")
    start: float = Field(..., description="Start time in seconds")
    duration: float = Field(..., description="Duration of snippet in seconds")
    end: float = Field(..., description="End time in seconds (start + duration)")
    timestamp_str: str = Field(..., description="Human-readable timestamp e.g. '04:12'")


class TranscriptRequest(BaseModel):
    """Payload sent by frontend to fetch captions for a video."""
    url: str = Field(
        ...,
        description="YouTube video URL or 11-character video ID",
        example="https://youtu.be/HpsjPUwQHfw",
    )


class TranscriptResponse(BaseModel):
    """Structured response containing all timestamped snippets for a lecture."""
    video_id: str
    total_snippets: int
    duration_seconds: float
    duration_formatted: str
    transcript: List[TranscriptItem]


class ChunkItem(BaseModel):
    """A semantically coherent chunk with preserved time boundaries."""
    chunk_id: str = Field(..., description="Unique chunk identifier e.g. chunk_0")
    text: str = Field(..., description="Merged spoken text for this section")
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    start_formatted: str = Field(..., description="Start time formatted (MM:SS)")
    end_formatted: str = Field(..., description="End time formatted (MM:SS)")
    word_count: int = Field(..., description="Number of words in this chunk")


class ChunkRequest(BaseModel):
    """Request to fetch and chunk a video's transcript."""
    url: str = Field(..., example="https://youtu.be/HpsjPUwQHfw")
    target_words: int = Field(default=180, description="Target word count per chunk (~1 to 1.5 mins)")
    overlap_words: int = Field(default=35, description="Number of overlapping words between consecutive chunks")


class ChunkResponse(BaseModel):
    """Response containing the list of semantic chunks with time bounds."""
    video_id: str
    total_raw_snippets: int
    total_chunks: int
    target_words: int
    overlap_words: int
    chunks: List[ChunkItem]


class ProcessVideoRequest(BaseModel):
    """Payload to trigger end-to-end ingestion and indexing of a video."""
    url: str = Field(..., example="https://youtu.be/HpsjPUwQHfw")
    target_words: int = Field(default=180, description="Target word count per chunk")
    overlap_words: int = Field(default=35, description="Overlap words between chunks")


class ProcessVideoResponse(BaseModel):
    """Result of the video indexing process."""
    video_id: str
    status: str
    collection_name: str
    total_chunks: int
    raw_snippets_count: int
    message: str


class SearchLectureRequest(BaseModel):
    """Query to search within an indexed lecture."""
    url_or_video_id: str = Field(..., example="aircAruvnKk")
    query: str = Field(..., example="How do neurons and layers work?")
    top_k: int = Field(default=3, ge=1, le=10, description="Number of top chunks to return")


class SearchResultItem(BaseModel):
    """A matched lecture snippet from vector search."""
    chunk_id: str
    text: str
    start: float
    end: float
    start_formatted: str
    end_formatted: str
    similarity_score: float


class SearchLectureResponse(BaseModel):
    """Results from semantic vector search across a lecture."""
    video_id: str
    query: str
    results_count: int
    results: List[SearchResultItem]


class CitationItem(BaseModel):
    """A clickable citation linking back to the lecture timestamp."""
    timestamp_str: str = Field(..., description="Timestamp in MM:SS format, e.g. '03:25'")
    seconds: float = Field(..., description="Timestamp in seconds for player.seekTo(seconds)")
    snippet: str = Field(..., description="Short transcript snippet for tooltip preview")


class ChatRequest(BaseModel):
    """Payload to ask a doubt about the lecture."""
    url_or_video_id: str = Field(..., example="aircAruvnKk")
    question: str = Field(..., example="What is an activation?")
    current_time: Optional[float] = Field(
        default=None,
        description="Current video playback position in seconds (enables proximity-aware answers)",
        example=205.0,
    )
    language: str = Field(
        default="en",
        description="Response language: 'en' (English), 'hinglish' (Hinglish), or 'hi' (Hindi)",
        example="en",
    )


class ChatResponse(BaseModel):
    """Grounded answer with interactive citations."""
    video_id: str
    question: str
    answer: str
    citations: List[CitationItem]
    sources: List[SearchResultItem]
    language: str


class NoteTopic(BaseModel):
    """A structured revision topic with summary and timestamp bounds."""
    title: str = Field(..., description="Title of the lecture topic")
    timestamp_str: str = Field(..., description="Formatted start timestamp e.g. '03:25'")
    start: float = Field(..., description="Start time in seconds")
    end: float = Field(..., description="End time in seconds")
    summary_points: List[str] = Field(..., description="Key bullet points taught in this segment")
    key_takeaway: str = Field(..., description="Core concept summary sentence")


class NotesRequest(BaseModel):
    url_or_video_id: str = Field(..., example="aircAruvnKk")
    language: str = Field(default="hinglish", description="'en', 'hinglish', or 'hi'")


class NotesResponse(BaseModel):
    video_id: str
    topics: List[NoteTopic]
    language: str


class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[str]
    correct_index: int
    explanation: str
    timestamp_str: str
    timestamp_seconds: float


class QuizRequest(BaseModel):
    url_or_video_id: str = Field(..., example="aircAruvnKk")
    language: str = Field(default="hinglish", description="'en', 'hinglish', or 'hi'")
    num_questions: int = Field(default=4, ge=1, le=8)


class QuizResponse(BaseModel):
    video_id: str
    questions: List[QuizQuestion]
    language: str




