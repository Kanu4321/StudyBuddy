import React, { useState, useRef, useEffect } from 'react'
import { Send, Clock, Sparkles, MessageSquare } from 'lucide-react'

// Helper to convert MM:SS to seconds if citation metadata is missing
function parseTimestampToSeconds(ts) {
  const parts = ts.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

export default function ChatPanel({
  messages,
  onSendMessage,
  onSeek,
  isLoading,
  selectedLanguage,
  onLanguageChange,
}) {
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!inputText.trim() || isLoading) return
    onSendMessage(inputText.trim())
    setInputText('')
  }

  // Parses [MM:SS] badges inside assistant markdown/text and turns them into interactive buttons
  const renderMessageContent = (text, citations = []) => {
    const parts = text.split(/(\[\d{1,2}:\d{2}(?::\d{2})?\])/g)

    return parts.map((part, index) => {
      const match = part.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]$/)
      if (match) {
        const ts = match[1]
        const citation = citations.find((c) => c.timestamp_str === ts)
        const seconds = citation ? citation.seconds : parseTimestampToSeconds(ts)

        return (
          <button
            key={index}
            className="citation-badge"
            title={citation?.snippet ? `"${citation.snippet}"` : `Jump video to ${ts}`}
            onClick={() => onSeek(seconds)}
          >
            <Clock size={12} />
            {ts}
          </button>
        )
      }
      return <span key={index}>{part}</span>
    })
  }

  return (
    <div className="chat-column">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-title">
          <Sparkles size={18} color="#818cf8" />
          <span>Lecture AI Companion</span>
        </div>

        {/* Language selector - Toggle buttons for Hinglish & English */}
        <div className="lang-toggle" title="Select explanation language">
          <button
            className={`lang-btn ${selectedLanguage === 'hinglish' ? 'active' : ''}`}
            onClick={() => onLanguageChange('hinglish')}
            aria-pressed={selectedLanguage === 'hinglish'}
          >
            Hinglish
          </button>
          <button
            className={`lang-btn ${selectedLanguage === 'en' ? 'active' : ''}`}
            onClick={() => onLanguageChange('en')}
            aria-pressed={selectedLanguage === 'en'}
          >
            English
          </button>
        </div>
      </div>

      {/* Message List */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <MessageSquare className="empty-chat-icon" />
            <p style={{ fontWeight: 500, color: '#94a3b8' }}>
              {selectedLanguage === 'hi' ? 'इस लेक्चर के बारे में कुछ भी पूछें!' : 'Ask anything about this lecture!'}
            </p>
            <p style={{ fontSize: '0.8rem', maxWidth: 280 }}>
              {selectedLanguage === 'hi'
                ? 'संदेह प्रोफेसर के ट्रांसक्रिप्ट से सख्ती से उत्तरित होते हैं जिनमें क्लिक करने योग्य टाइमस्टैम्प होते हैं।'
                : 'Doubts are answered strictly from the professor\'s transcript with clickable jump timestamps.'}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-bubble ${
                msg.sender === 'user' ? 'message-user' : 'message-assistant'
              }`}
            >
              <div className="message-sender">
                {msg.sender === 'user' ? 'You' : 'AI Companion'}
              </div>
              <div className="message-text">
                {msg.sender === 'assistant'
                  ? renderMessageContent(msg.text, msg.citations)
                  : msg.text}
              </div>

              {/* Citations Quick-Jump Footer */}
              {msg.sender === 'assistant' && msg.citations && msg.citations.length > 0 && (
                <div className="citations-footer">
                  <span className="citations-label">Jump to:</span>
                  {msg.citations.map((c, i) => (
                    <button
                      key={i}
                      className="citation-badge"
                      title={c.snippet}
                      onClick={() => onSeek(c.seconds)}
                    >
                      <Clock size={11} /> {c.timestamp_str}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="message-bubble message-assistant" style={{ fontStyle: 'italic', color: '#94a3b8' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} className="animate-spin" /> Grounding answer in lecture transcript...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder={
            selectedLanguage === 'hinglish'
              ? 'Apna doubt likho (e.g. weights aur biases kya karte hain?)...'
              : selectedLanguage === 'hi'
                ? 'अपना सवाल लिखें (उदाहरण: एक्टिवेशन फंक्शन क्या है?)...'
                : 'Ask a doubt about this lecture...'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="btn-send"
          disabled={!inputText.trim() || isLoading}
          title="Send message"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
