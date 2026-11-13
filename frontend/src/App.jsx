import React, { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Youtube,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  BookOpen,
  Brain,
  Play,
} from 'lucide-react'
import VideoPlayer from './components/VideoPlayer'
import ChatPanel from './components/ChatPanel'
import NotesPanel from './components/NotesPanel'
import QuizPanel from './components/QuizPanel'

const DEFAULT_VIDEO_URL = 'https://www.youtube.com/watch?v=aircAruvnKk'

function formatSeconds(sec) {
  const total = Math.floor(sec || 0)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function App() {
  const [url, setUrl] = useState(DEFAULT_VIDEO_URL)
  const [activeVideoId, setActiveVideoId] = useState('aircAruvnKk')
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'notes' | 'quiz'
  const [displayTime, setDisplayTime] = useState(0)
  const [isIndexing, setIsIndexing] = useState(false)
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [indexStatus, setIndexStatus] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [language, setLanguage] = useState('hinglish')

  // Optimization: use a ref for high-frequency current_time tracking so chat input doesn't lag
  const currentTimeRef = useRef(0)
  const playerRef = useRef(null)

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Namaste! Main aapka AI StudyBuddy hoon. Lecture ke baare mein koi bhi doubt pucho, notes dekho, ya quiz attempt karo!',
      citations: [],
    },
  ])

  // Auto-index default video on initial load
  useEffect(() => {
    handleProcessVideo(DEFAULT_VIDEO_URL)
  }, [])

  // Throttled time update callback from player
  const handleTimeUpdate = (seconds) => {
    currentTimeRef.current = seconds
    // Only update display state occasionally to keep UI fast
    setDisplayTime((prev) => (Math.abs(prev - seconds) >= 1 ? Math.floor(seconds) : prev))
  }

  const handleProcessVideo = async (targetUrl = url) => {
    if (!targetUrl.trim()) return

    setIsIndexing(true)
    setErrorMsg('')

    try {
      const response = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to process lecture video.')
      }

      const data = await response.json()
      setActiveVideoId(data.video_id)
      setIndexStatus({
        status: data.status,
        total_chunks: data.total_chunks,
        message: data.message,
      })

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'assistant',
          text: `Lecture (${data.video_id}) is ready! ${data.total_chunks} transcript chunks indexed with timestamps.`,
          citations: [],
        },
      ])
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setIsIndexing(false)
    }
  }

  const handleSendMessage = async (questionText) => {
    if (!activeVideoId) {
      setErrorMsg('Please load and index a video first.')
      return
    }

    const userMsgId = Date.now().toString()
    const newMessages = [
      ...messages,
      { id: userMsgId, sender: 'user', text: questionText },
    ]
    setMessages(newMessages)
    setIsChatLoading(true)
    setErrorMsg('')

    // Use current time from ref for real-time proximity-aware RAG
    const playbackTime = currentTimeRef.current

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url_or_video_id: activeVideoId,
          question: questionText,
          current_time: playbackTime,
          language: language,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Failed to get answer from AI.')
      }

      const data = await response.json()

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: data.answer,
          citations: data.citations || [],
        },
      ])
    } catch (err) {
      setErrorMsg(err.message)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'assistant',
          text: `Sorry, I encountered an error: ${err.message}`,
          citations: [],
        },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  // Jump player to exact second when a citation badge is clicked
  const handleSeek = (seconds) => {
    if (playerRef.current) {
      playerRef.current.seekTo(seconds)
    }
  }

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="top-header">
        <div className="brand-section">
          <div className="brand-title">
            <Sparkles size={22} color="#6366f1" />
            <span>StudyBuddy</span>
          </div>
          <span className="brand-badge">Grounded RAG</span>
        </div>

        {/* URL Ingestion Form */}
        <form
          className="url-form"
          onSubmit={(e) => {
            e.preventDefault()
            handleProcessVideo()
          }}
        >
          <input
            type="text"
            className="url-input"
            placeholder="Paste YouTube Lecture URL (e.g. https://www.youtube.com/watch?v=...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isIndexing}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={isIndexing || !url.trim()}
          >
            {isIndexing ? (
              <>
                <Sparkles size={16} className="animate-spin" /> Indexing...
              </>
            ) : (
              <>
                <Youtube size={16} /> Load Lecture
              </>
            )}
          </button>
        </form>

        {/* Index Status Badge */}
        <div>
          {indexStatus ? (
            <span className="status-pill status-ready">
              <CheckCircle2 size={14} /> {indexStatus.total_chunks} chunks ready
            </span>
          ) : (
            <span className="status-pill status-idle">Ready to load</span>
          )}
        </div>
      </header>

      {/* Global Error Banner */}
      {errorMsg && (
        <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Split Main Layout */}
      <main className="main-layout">
        {/* Left Column: Video Player */}
        <section className="video-column">
          <VideoPlayer
            ref={playerRef}
            videoId={activeVideoId}
            onTimeUpdate={handleTimeUpdate}
          />

          <div className="video-meta-bar">
            <div className="playback-indicator">
              <Play size={16} color="#6366f1" />
              <span>Current Position:</span>
              <span className="playback-time">{formatSeconds(displayTime)}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Click any timestamp citation in Chat, Notes, or Quiz to jump directly
            </div>
          </div>
        </section>

        {/* Right Column: Multi-tab Side Panel */}
        <section style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#111827', borderLeft: '1px solid #1f2937' }}>
          {/* Tab Navigation */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1f2937', background: '#0f172a' }}>
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                flex: 1,
                padding: '10px 14px',
                background: activeTab === 'chat' ? '#111827' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'chat' ? '2px solid #6366f1' : 'none',
                color: activeTab === 'chat' ? '#ffffff' : '#94a3b8',
                fontWeight: activeTab === 'chat' ? 600 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <MessageSquare size={16} /> Chat
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              style={{
                flex: 1,
                padding: '10px 14px',
                background: activeTab === 'notes' ? '#111827' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'notes' ? '2px solid #6366f1' : 'none',
                color: activeTab === 'notes' ? '#ffffff' : '#94a3b8',
                fontWeight: activeTab === 'notes' ? 600 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <BookOpen size={16} /> Revision Notes
            </button>

            <button
              onClick={() => setActiveTab('quiz')}
              style={{
                flex: 1,
                padding: '10px 14px',
                background: activeTab === 'quiz' ? '#111827' : 'transparent',
                border: 'none',
                borderBottom: activeTab === 'quiz' ? '2px solid #6366f1' : 'none',
                color: activeTab === 'quiz' ? '#ffffff' : '#94a3b8',
                fontWeight: activeTab === 'quiz' ? 600 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Brain size={16} /> Quiz
            </button>
          </div>

          {/* Active Tab View */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'chat' && (
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                onSeek={handleSeek}
                isLoading={isChatLoading}
                selectedLanguage={language}
                onLanguageChange={setLanguage}
              />
            )}

            {activeTab === 'notes' && (
              <NotesPanel
                videoId={activeVideoId}
                language={language}
                onSeek={handleSeek}
              />
            )}

            {activeTab === 'quiz' && (
              <QuizPanel
                videoId={activeVideoId}
                language={language}
                onSeek={handleSeek}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
