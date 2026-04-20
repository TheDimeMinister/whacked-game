import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

export function ForgotPasswordScreen() {
  const { user, loading, resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
      <div className="auth-screen brand-stage">
        <div className="auth-screen__stack">
          <div className="auth-screen__panel">
            <p className="muted">Loading…</p>
          </div>
        </div>
      </div>
    )
  }

  if (user) return <Navigate to="/app/lobby" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
    const { error } = await resetPasswordForEmail(email.trim())
    setBusy(false)
    if (error) setMsg(error.message)
    else
      setMsg(
        'If an account exists for that email, we sent reset instructions. Check your inbox and spam folder.',
      )
  }

  return (
    <div className="auth-screen brand-stage">
      <div className="auth-screen__stack">
        <header className="auth-screen__masthead">
          <div className="auth-screen__head">
            <h1 className="auth-brand">
              <img
                src="/brand/whacked-logo-no-bg.svg"
                alt="Whacked!"
                decoding="async"
              />
            </h1>
          </div>
        </header>
        <div className="auth-screen__panel">
          <p className="tagline auth-tagline">Reset your password</p>
          <form className="auth-form" onSubmit={submit}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            {msg ? <p className="form-msg">{msg}</p> : null}
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : 'Send reset link'}
            </button>
          </form>
          <Link className="linkish auth-mode-toggle" to="/auth">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
