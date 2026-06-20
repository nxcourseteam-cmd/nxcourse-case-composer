import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'

// Supabase Auth — supports both magic link and email+password (HANDOFF §4A).
export default function Login() {
  const { session, loading } = useAuth()
  const [mode, setMode] = useState('magic') // 'magic' | 'password'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  if (!loading && session) return <Navigate to="/" replace />

  async function handleMagicLink(e) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setMsg(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(false)
    if (error) setErr(error.message)
    else setMsg('Check your email for a sign-in link.')
  }

  async function handlePassword(e) {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
    // On success, onAuthStateChange flips session and the Navigate above redirects.
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <h1 style={{ fontSize: 20 }}>Case Study Composer</h1>
        </div>
        <p className="muted" style={{ marginTop: 0, marginBottom: 24, fontSize: 14 }}>
          Sign in to review and compose case studies.
        </p>

        <form onSubmit={mode === 'magic' ? handleMagicLink : handlePassword} className="stack">
          <div>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@example.com"
            />
          </div>

          {mode === 'password' && (
            <div>
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {err && <div className="error-text">{err}</div>}
          {msg && (
            <div style={{ color: 'var(--teal-dark)', fontSize: 13 }}>{msg}</div>
          )}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy && <span className="spinner" />}
            {mode === 'magic' ? 'Send magic link' : 'Sign in'}
          </button>
        </form>

        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 16, width: '100%' }}
          onClick={() => {
            setMode(mode === 'magic' ? 'password' : 'magic')
            setErr(null)
            setMsg(null)
          }}
        >
          {mode === 'magic' ? 'Use email + password instead' : 'Use a magic link instead'}
        </button>
      </div>
    </div>
  )
}
