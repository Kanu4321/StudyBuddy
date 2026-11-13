import { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Youtube,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  BookOpen,
  Brain,
  Play,
  User,
  LogOut,
  LayoutDashboard,
  Video,
} from 'lucide-react'
import VideoPlayer from './components/VideoPlayer'
import ChatPanel from './components/ChatPanel'
import NotesPanel from './components/NotesPanel'
import QuizPanel from './components/QuizPanel'
import Dashboard from './components/Dashboard'
import AuthScreen from './components/AuthScreen'
import { apiFetch, authApi, setUnauthorizedCallback } from './api'

const DEFAULT_VIDEO_URL = 'https://youtu.be/HpsjPUwQHfw'

function formatSeconds(sec) {
  const total = Math.floor(sec || 0)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [isAuthChecking, setIsAuthChecking] = useState(true)

  const [mainView, setMainView] = useState('study') // 'study' | 'dashboard'
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

  // Check auth status on mount
  useEffect(() => {
    // Register 401 callback to reset user state immediately
    setUnauthorizedCallback(() => {
      setCurrentUser(null)
    })

    const checkAuth = async () => {
      try {
        const userData = await authApi.getMe()
        setCurrentUser(userData)
        // Auto-index default video once authenticated
        handleProcessVideo(DEFAULT_VIDEO_URL)
      } catch (err) {
        setCurrentUser(null)
      } finally {
        setIsAuthChecking(false)
      }
    }

    checkAuth()
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
      const response = await apiFetch('/api/process', {
        method: 'POST',
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
      const response = await apiFetch('/api/chat', {
        method: 'POST',
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

  const handleResumeLecture = (videoId) => {
    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`
    setUrl(targetUrl)
    setActiveVideoId(videoId)
    setMainView('study')
    handleProcessVideo(targetUrl)
  }

  const handleSeekToQuestion = (videoId, seconds) => {
    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`
    setUrl(targetUrl)
    setActiveVideoId(videoId)
    setMainView('study')
    if (activeVideoId !== videoId) {
      handleProcessVideo(targetUrl)
    }
    setTimeout(() => {
      handleSeek(seconds)
    }, 400)
  }

  const handleAuthSuccess = (userData) => {
    setCurrentUser(userData)
    handleProcessVideo(DEFAULT_VIDEO_URL)
  }

  // Initial loading spinner while checking persisted token
  if (isAuthChecking) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        background: '#0b0f19',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
        color: '#94a3b8',
        fontFamily: "'Inter', sans-serif",
      }}>
        <Sparkles size={28} color="#6366f1" className="animate-spin" />
        <span style={{ fontSize: '0.9rem' }}>Loading StudyBuddy...</span>
      </div>
    )
  }

  // If not logged in, show Auth Screen
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />
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

        {/* View Switcher: Study Room vs Revision Dashboard */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: '#0f172a',
          padding: '3px',
          borderRadius: '8px',
          border: '1px solid #1f2937',
          gap: '4px',
        }}>
          <button
            type="button"
            onClick={() => setMainView('study')}
            style={{
              background: mainView === 'study' ? '#4f46e5' : 'transparent',
              color: mainView === 'study' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <Video size={14} />
            <span>Study Room</span>
          </button>

          <button
            type="button"
            onClick={() => setMainView('dashboard')}
            style={{
              background: mainView === 'dashboard' ? '#4f46e5' : 'transparent',
              color: mainView === 'dashboard' ? '#ffffff' : '#94a3b8',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <LayoutDashboard size={14} />
            <span>Revision Dashboard</span>
          </button>
        </div>

        {/* URL Ingestion Form (when in Study Room) */}
        {mainView === 'study' && (
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
        )}

        {/* Right side: Index Status & User Account Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {mainView === 'study' && (
            indexStatus ? (
              <span className="status-pill status-ready">
                <CheckCircle2 size={14} /> {indexStatus.total_chunks} chunks ready
              </span>
            ) : (
              <span className="status-pill status-idle">Ready to load</span>
            )
          )}

          {/* User Profile Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#1e293b',
            border: '1px solid #334155',
            padding: '5px 10px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            color: '#cbd5e1',
          }}>
            <User size={13} color="#818cf8" />
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.is_guest ? 'Guest' : currentUser.email}
            </span>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => authApi.logout()}
            style={{
              background: 'transparent',
              border: '1px solid #374151',
              color: '#9ca3af',
              padding: '5px 10px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.2s',
            }}
            title="Log out of StudyBuddy"
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {errorMsg && (
        <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Content Area */}
      {mainView === 'dashboard' ? (
        <Dashboard
          onResumeLecture={handleResumeLecture}
          onSeekToQuestion={handleSeekToQuestion}
          onBackToStudy={() => setMainView('study')}
        />
      ) : (
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
      )}
    </div>
  )
}
