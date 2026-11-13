from typing import List, Dict, Any
from app.services.transcript import format_timestamp


def chunk_transcript(
    snippets: List[Dict[str, Any]],
    target_words: int = 180,
    overlap_words: int = 35,
) -> List[Dict[str, Any]]:
    """
    Groups raw subtitle snippets into coherent, semantically complete chunks
    while strictly preserving the precise start and end timestamps.

    Args:
        snippets: List of raw subtitle items from transcript.py
                  (each item has 'text', 'start', 'end', 'duration')
        target_words: Target word count per chunk (~1.2 - 1.5 minutes of speech)
        overlap_words: Number of words to carry over into the next chunk
                       to prevent sentences from being sliced in half

    Returns:
        List of chunks with preserved time boundaries:
        [
          {
            "chunk_id": "chunk_0",
            "text": "Complete spoken thought across 1-2 minutes...",
            "start": 0.0,
            "end": 74.5,
            "start_formatted": "00:00",
            "end_formatted": "01:14",
            "word_count": 182
          }, ...
        ]
    """
    if not snippets:
        return []

    chunks: List[Dict[str, Any]] = []
    chunk_index = 0
    i = 0
    total_snippets = len(snippets)

    while i < total_snippets:
        current_chunk_snippets = []
        current_word_count = 0
        start_snippet_idx = i

        # Accumulate snippets until target_words is reached
        while i < total_snippets and current_word_count < target_words:
            snippet = snippets[i]
            current_chunk_snippets.append(snippet)
            words = snippet["text"].split()
            current_word_count += len(words)
            i += 1

        if not current_chunk_snippets:
            break

        # Extract boundaries
        first_snippet = current_chunk_snippets[0]
        last_snippet = current_chunk_snippets[-1]

        combined_text = " ".join(s["text"] for s in current_chunk_snippets)
        start_time = first_snippet["start"]
        end_time = last_snippet["end"]

        chunks.append({
            "chunk_id": f"chunk_{chunk_index}",
            "text": combined_text,
            "start": start_time,
            "end": end_time,
            "start_formatted": format_timestamp(start_time),
            "end_formatted": format_timestamp(end_time),
            "word_count": current_word_count,
        })
        chunk_index += 1

        # If we reached the end of all snippets, we are done
        if i >= total_snippets:
            break

        # Calculate overlap: step backwards so the next chunk starts with
        # the last few snippets covering approximately overlap_words
        overlap_count = 0
        step_back = 0
        for s in reversed(current_chunk_snippets):
            w = len(s["text"].split())
            if overlap_count + w > overlap_words and step_back > 0:
                break
            overlap_count += w
            step_back += 1

        # Move i backwards by step_back, ensuring we always advance forward at least 1 snippet
        # to prevent any infinite loops
        next_i = i - step_back
        if next_i <= start_snippet_idx:
            next_i = start_snippet_idx + 1
        i = next_i

    return chunks
