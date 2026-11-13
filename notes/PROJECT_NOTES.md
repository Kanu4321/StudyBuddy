# Project Notes & Judge Q&A Guide

## Problem & Solution
- **Problem Statement:** "Making Online Learning More Interactive."
- **Target Persona:** Arjun, 1st-year engineering student watching dense 50-minute lectures.
- **Solution:** A split-screen web app with an embedded YouTube player and a grounded RAG companion citing clickable timestamps to jump the video directly to relevant explanations.

---

## Technical Decisions Log

| Decision Area | Choice | Rationale for Judges |
| :--- | :--- | :--- |
| **Backend Framework** | Python + FastAPI | High performance (async), built-in OpenAPI/Swagger docs, automatic Pydantic request validation. |
| **Frontend Framework** | React + Vite | Fast HMR (Hot Module Replacement), component-based design, native support for YouTube IFrame API. |
| **LLM Provider** | Google Gemini (Gemini 1.5 Flash) | High throughput, low latency, generous free tier limits for hackathons, strong multilingual (Hindi) capabilities. |
| **Vector Store** | ChromaDB (Local Embedded) | Zero cloud database setup/cost; runs in-process via SQLite; persists directly on disk. |
| **RAG vs Full Context** | Semantic Retrieval with Chunking | Lowers latency, reduces token cost by ~90%, prevents LLM drifting/hallucinations, bridges vocabulary mismatch, and scales to marathon lectures. |
| **Timestamp Retention** | Metadata with Start and End bounds | Start enables `player.seekTo()`; end bounds snippets and prevents overlapping citations; ranges enable rewind confusion detection. |
| **Transcript Ingestion** | `youtube-transcript-api` (fallback hierarchy) | Prioritizes manual English/Hindi captions -> auto-generated captions -> any available track. Computes `end = start + duration` for exact segment bounds. |
| **Chunking Strategy** | Window of ~180 words with ~35-word overlap (~1-1.5 min) | Spoken English is ~130-150 words/min. 180 words captures a full conceptual thought. Overlap ensures sentences aren't split across chunks. Preserves `start` of 1st snippet and `end` of last snippet. |
| **Multilingual Support** | English + Hinglish + Hindi toggle | Gemini natively handles Hindi and Hinglish (Latin-script Hindi). User can choose explanation style according to convenience. |
| **Embedding Model** | Google Gemini `gemini-embedding-001` (3072 dimensions) with Task Types | Uses `RETRIEVAL_DOCUMENT` for indexing chunks and `RETRIEVAL_QUERY` for student queries. Asymmetric embeddings optimize retrieval accuracy for short question vs longer paragraph comparisons. |
| **Vector DB Architecture** | ChromaDB Persistent with Isolated Collections (`lecture_{video_id}`) | Each lecture has its own dedicated collection. Prevents cross-video chunk leakage, allows instant existence check (`count > 0`) to avoid duplicate API calls, and queries run in <5ms. |
| **Context-Aware RAG & Proximity** | Semantic Search + Temporal Proximity Boost (`current_time`) | If Arjun asks a question while watching at minute 12:30, chunks within 120s of playback receive a similarity score boost, prioritizing the segment he is currently experiencing. |
| **Grounded Citations** | Strict `[MM:SS]` prompt instruction + regex extraction | The LLM must cite exact timestamps matching retrieved chunks. Backend parses these into numeric seconds (`seconds: 205.0`) so frontend can trigger `player.seekTo(seconds)`. |
| **Player Architecture** | YouTube IFrame API via React forwardRef / ImperativeHandle | Full programmatic control over playback, real-time polling (500ms) for proximity context, and instant seek to cited seconds with zero page reload. |
| **Interactive Citations UI** | Inline parsed badge buttons (`[MM:SS]`) + Citation Cards | Converts text timestamps into interactive badges with hover quote tooltips. Single click executes `player.seekTo(seconds, true)`. |
| **High-Frequency State Performance** | `useRef` for 500ms time polling | Prevents unnecessary re-renders of the entire App and chat input, while ensuring the exact playback second is sent when submitting a question. |
| **Structured Output Schema** | `response_mime_type="application/json"` | Guarantees strict JSON output for notes topics and interactive quiz objects; prevents frontend parsing crashes. |
| **Active Recall Testing** | Conceptual Multiple Choice with Video Review Links | Solves Arjun's "rewatch the entire lecture" dilemma by testing understanding and linking wrong answers directly to the video explanation timestamp. |
| **Resilience & Failover** | Automatic Gemini Model Cascade | Failover across `gemini-3.5-flash-lite` -> `gemini-3.5-flash` -> `gemini-3.8-flash` prevents 503 temporary demand spike failures. |
| **Explain Differently (Step 8)** | Semantic Router (Embedding-Based Intent Detection) | Pre-embeds 40+ example phrases per mode (analogy/simple/example/alternative). At query time, embeds user question with RETRIEVAL_QUERY task type, computes cosine similarity against cached mode embeddings. Routes to mode if max similarity ≥ 0.75, else standard RAG. Uses same `gemini-embedding-001` model, zero extra infra. Robust to Hinglish/English/Hindi paraphrasing. Injects dynamic style instruction into system prompt. Same chat UI, zero new components. |
| **Multilingual Support (Step 9)** | Native Hindi + Hinglish + English Toggle | Three language modes: English, Hinglish (Hindi in Latin script, per Indian educator style), and Hindi (Devanagari). Language preference passed via `language` param to all endpoints (chat, notes, quiz). LLM system prompt adjusts tone/script per mode. Frontend Chat/Notes/Quiz panels localize placeholders, buttons, empty states, score labels, feedback text. Clickable citations work identically across all languages. |
