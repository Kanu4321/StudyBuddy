import React, { useState } from 'react'
import { Brain, Clock, Sparkles, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

export default function QuizPanel({ videoId, language, onSeek }) {
  const [questions, setQuestions] = useState(null)
  const [selectedAnswers, setSelectedAnswers] = useState({}) // { questionId: selectedIndex }
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchQuiz = async () => {
    if (!videoId) return
    setIsLoading(true)
    setError('')
    setSelectedAnswers({})
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url_or_video_id: videoId, language, num_questions: 4 }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to generate quiz.')
      }
      const data = await res.json()
      setQuestions(data.questions)
    } catch (e) {
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectOption = (qId, optionIdx) => {
    // Only allow selecting once per question
    if (selectedAnswers[qId] !== undefined) return
    setSelectedAnswers((prev) => ({ ...prev, [qId]: optionIdx }))
  }

  // Calculate score
  const totalAnswered = Object.keys(selectedAnswers).length
  const totalCorrect = questions
    ? questions.filter((q) => selectedAnswers[q.id] === q.correct_index).length
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top action bar */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid #1f2937', background: '#131b2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.92rem', color: '#f1f5f9' }}>
          <Brain size={18} color="#818cf8" />
          <span>Concept Mastery Quiz</span>
        </div>
        <button
          className="btn-primary"
          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
          onClick={fetchQuiz}
          disabled={isLoading || !videoId}
        >
          {isLoading ? <Sparkles size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          <span>{questions ? 'New Quiz' : 'Start Quiz'}</span>
        </button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {!questions && !isLoading && (
          <div className="empty-chat">
            <Brain className="empty-chat-icon" />
            <p style={{ fontWeight: 500, color: '#94a3b8' }}>
              {language === 'hi' ? 'अपनी समझ जांचें!' : 'Test your understanding!'}
            </p>
            <p style={{ fontSize: '0.8rem', maxWidth: 280 }}>
              {language === 'hi'
                ? 'इस लेक्चर पर आधारित सक्रिय-पुनरावृत्ति बहुविकल्पीय प्रश्न उत्पन्न करें। गलत उत्तर? सीधे व्याख्या टाइमस्टैम्प पर जाएं।'
                : 'Generate active-recall multiple choice questions grounded in this lecture. Wrong answer? Jump straight to the explanation timestamp.'}
            </p>
            <button className="btn-primary" onClick={fetchQuiz} style={{ marginTop: 8 }}>
              <Sparkles size={16} /> {language === 'hi' ? 'क्विज़ बनाएं' : 'Generate Concept Quiz'}
            </button>
          </div>
        )}

        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, color: '#94a3b8' }}>
            <Sparkles size={28} color="#818cf8" className="animate-spin" />
            <p style={{ fontSize: '0.9rem' }}>
              {language === 'hi'
                ? 'लेक्चर विषयों से अवधारणात्मक प्रश्न तैयार कर रहे हैं...'
                : 'Crafting conceptual questions from lecture topics...'}
            </p>
          </div>
        )}

        {questions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Score header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', fontSize: '0.85rem' }}>
              <span style={{ color: '#94a3b8' }}>
                {language === 'hi' ? 'प्रगति: ' : 'Progress: '}{totalAnswered} {language === 'hi' ? 'के' : 'of'} {questions.length} {language === 'hi' ? 'प्रश्न हल हुए' : 'answered'}
              </span>
              <span style={{ fontWeight: 600, color: '#34d399' }}>
                {language === 'hi' ? 'स्कोर: ' : 'Score: '}{totalCorrect} / {totalAnswered}
              </span>
            </div>

            {questions.map((q, idx) => {
              const selected = selectedAnswers[q.id]
              const hasAnswered = selected !== undefined
              const isCorrect = selected === q.correct_index

              return (
                <div
                  key={q.id || idx}
                  style={{
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <p style={{ color: '#f8fafc', fontSize: '0.92rem', fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
                    <span style={{ color: '#818cf8', fontWeight: 700 }}>
                      {language === 'hi' ? `प्रश्न ${idx + 1}. ` : `Q${idx + 1}. `}
                    </span>
                    {q.question}
                  </p>

                  {/* Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {q.options.map((opt, optIdx) => {
                      let btnStyle = {
                        background: '#0f172a',
                        border: '1px solid #334155',
                        color: '#cbd5e1',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        textAlign: 'left',
                        fontSize: '0.85rem',
                        cursor: hasAnswered ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }

                      if (hasAnswered) {
                        if (optIdx === q.correct_index) {
                          btnStyle.background = 'rgba(16, 185, 129, 0.2)'
                          btnStyle.borderColor = '#10b981'
                          btnStyle.color = '#34d399'
                        } else if (optIdx === selected) {
                          btnStyle.background = 'rgba(239, 68, 68, 0.2)'
                          btnStyle.borderColor = '#ef4444'
                          btnStyle.color = '#f87171'
                        } else {
                          btnStyle.opacity = 0.5
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          style={btnStyle}
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          disabled={hasAnswered}
                        >
                          <span>{opt}</span>
                          {hasAnswered && optIdx === q.correct_index && (
                            <CheckCircle2 size={16} color="#34d399" />
                          )}
                          {hasAnswered && optIdx === selected && optIdx !== q.correct_index && (
                            <XCircle size={16} color="#f87171" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                  {/* Feedback Explanation + Timestamp Jump */}
                  {hasAnswered && (
                    <div
                      style={{
                        background: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                        borderRadius: '8px',
                        padding: '10px 12px',
                        fontSize: '0.83rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ color: isCorrect ? '#34d399' : '#f87171', fontWeight: 600 }}>
                        {isCorrect
                          ? (language === 'hi' ? '✓ सही उत्तर!' : '✓ Correct Answer!')
                          : (language === 'hi' ? '✗ सही नहीं' : '✗ Not quite right')}
                      </div>
                      <div style={{ color: '#cbd5e1', lineHeight: 1.45 }}>
                        {q.explanation}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {language === 'hi' ? 'लेक्चर में अवधारणा दोहराएं:' : 'Review concept in lecture:'}
                        </span>
                        <button
                          className="citation-badge"
                          title={language === 'hi' ? 'वीडियो को व्याख्या पर ले जाएं' : 'Jump video to explanation'}
                          onClick={() => onSeek(q.timestamp_seconds)}
                        >
                          <Clock size={11} /> {q.timestamp_str}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
