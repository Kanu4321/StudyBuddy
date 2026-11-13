import { useState } from 'react'
import { Sparkles, Mail, Lock, AlertCircle, ArrowRight, User } from 'lucide-react'
import { authApi } from '../api'

export default function AuthScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.')
      return
    }

    if (mode === 'signup' && password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.')
      return
    }

    setIsLoading(true)
    try {
      let data
      if (mode === 'signup') {
        data = await authApi.signup(email.trim(), password)
      } else {
        data = await authApi.login(email.trim(), password)
      }
      onAuthSuccess(data.user)
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGuestLogin = async () => {
    setErrorMsg('')
    setIsLoading(true)
    try {
      const data = await authApi.guest()
      onAuthSuccess(data.user)
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start guest session.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0b0f19 70%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #4f46e5, #8b5cf6)',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
          }}>
            <Sparkles size={26} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            StudyBuddy
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
            Interactive, Grounded AI Lecture Companion
          </p>
        </div>

        {/* Mode Toggle (Login vs Sign Up) */}
        <div style={{
          display: 'flex',
          background: '#0f172a',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid #1f2937',
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg('') }}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: '8px',
              background: mode === 'login' ? '#4f46e5' : 'transparent',
              color: mode === 'login' ? '#ffffff' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setErrorMsg('') }}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: '8px',
              background: mode === 'signup' ? '#4f46e5' : 'transparent',
              color: mode === 'signup' ? '#ffffff' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div style={{
            background: '#7f1d1d',
            border: '1px solid #991b1b',
            color: '#fecaca',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Credential Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@college.edu"
                disabled={isLoading}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  padding: '10px 12px 10px 38px',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
              Password {mode === 'signup' && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>(min. 6 characters)</span>}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '12px' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  padding: '10px 12px 10px 38px',
                  fontSize: '0.88rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '8px',
              background: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: isLoading ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background 0.2s',
            }}
          >
            {isLoading ? (
              <>
                <Sparkles size={16} className="animate-spin" />
                <span>{mode === 'signup' ? 'Creating Account...' : 'Logging In...'}</span>
              </>
            ) : (
              <>
                <span>{mode === 'signup' ? 'Create Account' : 'Log In'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', background: '#1f2937' }} />
          <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#1f2937' }} />
        </div>

        {/* Anonymous Guest Button */}
        <button
          type="button"
          onClick={handleGuestLogin}
          disabled={isLoading}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#cbd5e1',
            borderRadius: '8px',
            padding: '11px',
            fontSize: '0.88rem',
            fontWeight: 500,
            cursor: isLoading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          <User size={16} color="#94a3b8" />
          <span>Continue as Guest</span>
        </button>
      </div>
    </div>
  )
}
