import re
from typing import List, Dict, Any
from urllib.parse import urlparse, parse_qs
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)


def extract_video_id(url_or_id: str) -> str:
    """
    Extracts the unique 11-character YouTube video ID from various URL formats or raw ID.
    Supports:
      - https://www.youtube.com/watch?v=VIDEO_ID
      - https://youtu.be/VIDEO_ID
      - https://www.youtube.com/embed/VIDEO_ID
      - https://www.youtube.com/shorts/VIDEO_ID
      - Raw 11-character ID (e.g. VIDEO_ID)
    """
    cleaned = url_or_id.strip()

    # Case 1: Raw 11-character video ID directly provided
    if re.fullmatch(r"[a-zA-Z0-9_-]{11}", cleaned):
        return cleaned

    # Case 2: Standard query parameter (e.g. watch?v=...)
    parsed = urlparse(cleaned)
    if "youtube.com" in parsed.netloc:
        query = parse_qs(parsed.query)
        if "v" in query and len(query["v"][0]) == 11:
            return query["v"][0]

    # Case 3: Path-based patterns (youtu.be/..., /embed/..., /shorts/...)
    regex = r"(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})"
    match = re.search(regex, cleaned)
    if match:
        return match.group(1)

    raise ValueError(f"Could not extract a valid 11-character YouTube video ID from: '{url_or_id}'")


def format_timestamp(seconds: float) -> str:
    """
    Converts raw seconds (e.g. 754.2) into a human-readable timestamp ('12:34' or '01:12:34').
    This is what the student sees in the UI citations.
    """
    total_seconds = int(seconds)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60

    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def fetch_transcript(video_id_or_url: str) -> List[Dict[str, Any]]:
    """
    Fetches timestamped subtitles from YouTube.
    Prioritizes English/Hindi transcripts (manual first, then auto-generated).
    Calculates `end` time for each snippet and standardizes output.
    """
    video_id = extract_video_id(video_id_or_url)

    try:
        ytt = YouTubeTranscriptApi()

        # Resilient listing: support both new v1.x and legacy versions
        if hasattr(ytt, "list"):
            transcript_list = ytt.list(video_id)
        else:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # Languages we prioritize for lectures (English and Hindi)
        preferred_langs = ["en", "en-US", "en-GB", "hi", "hi-Latn"]

        # 1. Try finding manual captions in preferred languages
        # 2. Else fall back to auto-generated captions
        # 3. Else fallback to first available language track
        try:
            transcript = transcript_list.find_transcript(preferred_langs)
        except Exception:
            try:
                transcript = transcript_list.find_generated_transcript(preferred_langs)
            except Exception:
                transcript = next(iter(transcript_list))

        raw_items = transcript.fetch()

        cleaned_items: List[Dict[str, Any]] = []
        for item in raw_items:
            # Handle both object attributes (.text) and dict keys (item['text'])
            text = getattr(item, "text", "") if not isinstance(item, dict) else item.get("text", "")
            start = getattr(item, "start", 0.0) if not isinstance(item, dict) else item.get("start", 0.0)
            duration = getattr(item, "duration", 0.0) if not isinstance(item, dict) else item.get("duration", 0.0)

            clean_text = text.replace("\n", " ").strip()
            if not clean_text:
                continue

            start_sec = round(float(start), 2)
            duration_sec = round(float(duration), 2)
            end_sec = round(start_sec + duration_sec, 2)

            cleaned_items.append({
                "text": clean_text,
                "start": start_sec,
                "duration": duration_sec,
                "end": end_sec,
                "timestamp_str": format_timestamp(start_sec),
            })

        if not cleaned_items:
            raise RuntimeError("Transcript was retrieved but contained no readable text.")

        return cleaned_items

    except TranscriptsDisabled:
        raise RuntimeError("Subtitles/Transcripts are disabled on this YouTube video.")
    except NoTranscriptFound:
        raise RuntimeError("No suitable transcript found for this video.")
    except VideoUnavailable:
        raise RuntimeError("The specified YouTube video is unavailable or private.")
    except Exception as e:
        raise RuntimeError(f"Error fetching YouTube transcript: {str(e)}")
