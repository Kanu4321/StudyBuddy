import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Clock,
  Play,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Video,
  HelpCircle,
} from 'lucide-react'
import { apiFetch, parseResponseJson } from '../api'

function formatDate(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (e) {
    return isoStr
  }
}

function formatSeconds(sec) {
  const total = Math.floor(sec || 0)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function Dashboard({ onResumeLecture, onSeekToQuestion, onBackToStudy }) {
  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all') // 'all' or specific video_id

  const fetchDashboardData = async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await apiFetch('/api/dashboard')
      const data = await parseResponseJson(res)
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to load dashboard data.')
      }
      setSummary(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const filteredQuestions = summary?.recent_questions
    ? selectedFilter === 'all'
      ? summary.recent_questions
      : summary.recent_questions.filter((q) => q.video_id === selectedFilter)
    : []

  return (
    <div style={{
      height: '100%',
      width: '100%',
      overflowY: 'auto',
      background: '#0b0f19',
      color: '#f8fafc',
      padding: '24px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    }}>
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #1f2937',
        paddingBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onBackToStudy}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#cbd5e1',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Study Room</span>
          </button>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutDashboard size={22} color="#6366f1" />
              <span>My Revision & History Dashboard</span>
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Personalized revision: review all lectures you explored and the doubts you asked.
            </p>
          </div>
        </div>

        <button
          onClick={fetchDashboardData}
          disabled={isLoading}
          style={{
            background: 'transparent',
            border: '1px solid #374151',
            color: '#9ca3af',
            padding: '7px 12px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RotateCcw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '10px 16px', borderRadius: '8px', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {isLoading && !summary && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '12px', color: '#94a3b8' }}>
          <Sparkles size={28} color="#6366f1" className="animate-spin" />
          <span>Loading your personalized revision history...</span>
        </div>
      )}

      {summary && (
        <>
          {/* Summary Metric Tiles (Real Data Only) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}>
            <div style={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: '12px',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}>
              <div style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                padding: '12px',
                borderRadius: '10px',
              }}>
                <Video size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>
                  Lectures Studied
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff' }}>
                  {summary.total_lectures_watched}
                </div>
              </div>
            </div>

            <div style={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: '12px',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}>
              <div style={{
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34d399',
                padding: '12px',
                borderRadius: '10px',
              }}>
                <MessageSquare size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>
                  Doubts Asked & Grounded
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff' }}>
                  {summary.total_questions_asked}
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Watched Lectures ("Kon konse lecture dekh liye") */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={18} color="#818cf8" />
              <span>Watched Lectures ({summary.watched_lectures.length})</span>
            </h3>

            {summary.watched_lectures.length === 0 ? (
              <div style={{
                background: '#111827',
                border: '1px dashed #374151',
                borderRadius: '12px',
                padding: '32px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '0.88rem',
              }}>
                You haven't loaded any lectures yet. Go back to the Study Room and load a YouTube lecture to begin!
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '14px',
              }}>
                {summary.watched_lectures.map((lec) => (
                  <div
                    key={lec.id}
                    style={{
                      background: '#111827',
                      border: '1px solid #1f2937',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                        <span style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#a5b4fc',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                        }}>
                          {lec.video_id}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {formatDate(lec.last_accessed_at)}
                        </span>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc', lineHeight: 1.3 }}>
                        {lec.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '6px' }}>
                        {lec.questions_count} {lec.questions_count === 1 ? 'doubt asked' : 'doubts asked'}
                      </div>
                    </div>

                    <button
                      onClick={() => onResumeLecture(lec.video_id)}
                      style={{
                        background: '#1e293b',
                        border: '1px solid #334155',
                        color: '#6366f1',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.borderColor = '#6366f1')}
                      onMouseOut={(e) => (e.currentTarget.style.borderColor = '#334155')}
                    >
                      <Play size={14} fill="#6366f1" />
                      <span>Resume Lecture</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Revision Questions ("Kya kya questions puche the") */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f1f5f9', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={18} color="#34d399" />
                <span>My Revision Doubts ({filteredQuestions.length})</span>
              </h3>

              {/* Filter by lecture */}
              {summary.watched_lectures.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
                  <span>Filter:</span>
                  <select
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value)}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  >
                    <option value="all">All Lectures</option>
                    {summary.watched_lectures.map((lec) => (
                      <option key={lec.video_id} value={lec.video_id}>
                        {lec.video_id} ({lec.questions_count} doubts)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {filteredQuestions.length === 0 ? (
              <div style={{
                background: '#111827',
                border: '1px dashed #374151',
                borderRadius: '12px',
                padding: '32px',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '0.88rem',
              }}>
                No doubts recorded yet. When you ask questions in the Chat panel during a lecture, they will appear here with clickable timestamp citations for quick exam revision!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredQuestions.map((q) => (
                  <div
                    key={q.id}
                    style={{
                      background: '#111827',
                      border: '1px solid #1f2937',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {/* Doubt Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#a5b4fc',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                        }}>
                          Lecture: {q.video_id}
                        </span>
                        {q.playback_time !== null && q.playback_time !== undefined && (
                          <span style={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            color: '#94a3b8',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            <Clock size={11} /> Asked at {formatSeconds(q.playback_time)}
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {formatDate(q.created_at)}
                        </span>
                      </div>

                      {q.playback_time !== null && q.playback_time !== undefined && (
                        <button
                          onClick={() => onSeekToQuestion(q.video_id, q.playback_time)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #4338ca',
                            color: '#a5b4fc',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            flexShrink: 0,
                          }}
                        >
                          <Play size={11} fill="#a5b4fc" />
                          <span>Jump to Moment</span>
                        </button>
                      )}
                    </div>

                    {/* Question */}
                    <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.92rem', lineHeight: 1.4 }}>
                      Q: {q.question}
                    </div>

                    {/* Grounded Answer */}
                    <div style={{
                      background: '#1e293b',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      color: '#cbd5e1',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      borderLeft: '3px solid #6366f1',
                    }}>
                      <div style={{ color: '#818cf8', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase' }}>
                        AI Grounded Answer
                      </div>
                      <div>{q.answer}</div>

                      {/* Clickable Citations */}
                      {q.citations && q.citations.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #334155' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            Lecture Citations:
                          </span>
                          {q.citations.map((c, i) => (
                            <button
                              key={i}
                              className="citation-badge"
                              title={c.snippet || `Jump to ${c.timestamp_str}`}
                              onClick={() => onSeekToQuestion(q.video_id, c.seconds)}
                              style={{ cursor: 'pointer' }}
                            >
                              <Clock size={11} /> {c.timestamp_str}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
