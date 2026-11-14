import { useState } from 'react'
import { BookOpen, Clock, Sparkles, RefreshCw } from 'lucide-react'
import { apiFetch, parseResponseJson } from '../api'

export default function NotesPanel({ videoId, language, onSeek }) {
  const [notes, setNotes] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchNotes = async () => {
    if (!videoId) return
    setIsLoading(true)
    setError('')
    try {
      const res = await apiFetch('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ url_or_video_id: videoId, language }),
      })
      const data = await parseResponseJson(res)
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to generate notes.')
      }
      setNotes(data.topics)
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top action bar */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid #1f2937', background: '#131b2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.92rem', color: '#f1f5f9' }}>
          <BookOpen size={18} color="#818cf8" />
          <span>Structured Revision Notes</span>
        </div>
        <button
          className="btn-primary"
          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
          onClick={fetchNotes}
          disabled={isLoading || !videoId}
        >
          {isLoading ? <Sparkles size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          <span>{notes ? 'Regenerate' : 'Generate Notes'}</span>
        </button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {!notes && !isLoading && (
          <div className="empty-chat">
            <BookOpen className="empty-chat-icon" />
            <p style={{ fontWeight: 500, color: '#94a3b8' }}>
              {language === 'hi' ? 'अभी तक नोट्स नहीं बने हैं।' : 'No notes generated yet.'}
            </p>
            <p style={{ fontSize: '0.8rem', maxWidth: 280 }}>
              {language === 'hi'
                ? '"नोट्स बनाएं" पर क्लिक करके प्रोफेसर के लेक्चर से टाइमस्टैम्प्ड सारांश और मुख्य बातें बनाएं।'
                : 'Click "Generate Notes" to create timestamped summaries and key takeaways directly from the professor\'s lecture.'}
            </p>
            <button className="btn-primary" onClick={fetchNotes} style={{ marginTop: 8 }}>
              <Sparkles size={16} /> {language === 'hi' ? 'नोट्स बनाएं' : 'Generate Revision Notes'}
            </button>
          </div>
        )}

        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, color: '#94a3b8' }}>
            <Sparkles size={28} color="#818cf8" className="animate-spin" />
            <p style={{ fontSize: '0.9rem' }}>
              {language === 'hi'
                ? 'पूरे लेक्चर का ट्रांसक्रिप्ट विश्लेषण करके नोट्स तैयार कर रहे हैं...'
                : 'Analyzing full lecture transcript & synthesizing notes...'}
            </p>
          </div>
        )}

        {notes && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {notes.map((topic, i) => (
              <div
                key={i}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {/* Topic Header with Jump Badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <h4 style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
                    {topic.title}
                  </h4>
                  <button
                    className="citation-badge"
                    title={`Jump to ${topic.timestamp_str}`}
                    onClick={() => onSeek(topic.start)}
                    style={{ flexShrink: 0 }}
                  >
                    <Clock size={12} /> {topic.timestamp_str}
                  </button>
                </div>

                {/* Summary Bullets */}
                <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '0.86rem', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {topic.summary_points?.map((pt, j) => (
                    <li key={j} style={{ lineHeight: 1.45 }}>{pt}</li>
                  ))}
                </ul>

                {/* Key Takeaway Pill */}
                {topic.key_takeaway && (
                  <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '6px', padding: '8px 10px', fontSize: '0.82rem', color: '#c7d2fe' }}>
                    <strong style={{ color: '#a5b4fc' }}>
                      {language === 'hi' ? 'मुख्य बात: ' : 'Key Takeaway: '}
                    </strong>
                    {topic.key_takeaway}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
