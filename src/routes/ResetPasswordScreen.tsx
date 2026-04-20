import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

function urlLooksLikePasswordRecovery(): boolean {
  const hash = window.location.hash.replace(/^#/, '')
  const q = new URLSearchParams(window.location.search)
  const hp = new URLSearchParams(hash)
  if (hp.get('type') === 'recovery' || q.get('type') === 'recovery') return true
  if (q.get('code')) return true
  if (hash.includes('type=recovery')) return true
  return false
}

export function ResetPasswordScreen() {
  const { user, loading, supabase, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [recoveryReady, setRecoveryReady] = useState(() =>
    urlLooksLikePasswordRecovery(),
  )
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sessionWaitTimedOut, setSessionWaitTimedOut] = useState(false)

  useEffect(() => {
    if (urlLooksLikePasswordRecovery()) setRecoveryReady(true)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryReady(true)
      if (
        event === 'SIGNED_IN' &&
        window.location.pathname.includes('/auth/reset-password') &&
        urlLooksLikePasswordRecovery()
      ) {
        setRecoveryReady(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (user) setSessionWaitTimedOut(false)
  }, [user])

  useEffect(() => {
    if (!recoveryReady || user || loading) return
    const id = window.setTimeout(() => setSessionWaitTimedOut(true), 8000)
    return () => window.clearTimeout(id)
  }, [recoveryReady, user, loading])

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

  if (user && !recoveryReady) {
    return <Navigate to="/app/lobby" replace />
  }

  if (recoveryReady && !user && !loading) {
    if (!sessionWaitTimedOut) {
      return (
        <div className="auth-screen brand-stage">
          <div className="auth-screen__stack">
            <div className="auth-screen__panel">
              <p className="muted">Verifying reset link…</p>
            </div>
          </div>
        </div>
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
            <p className="tagline auth-tagline">Link expired or invalid</p>
            <p className="muted small">
              Request a new reset link and open it on this device in the same
              browser.
            </p>
            <Link className="btn btn--primary" to="/auth/forgot-password">
              Request reset link
            </Link>
            <Link className="linkish auth-mode-toggle" to="/auth">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (password.length < 6) {
      setMsg('Password must be at least 6 characters.')
      return
    }
    if (password !== password2) {
      setMsg('Passwords do not match.')
      return
    }
    setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) setMsg(error.message)
    else {
      void navigate('/auth?reset=success', { replace: true })
    }
  }

  if (!recoveryReady) {
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
            <p className="tagline auth-tagline">Link not ready</p>
            <p className="muted small">
              Open the reset link from your email in this browser, or request a new
              one if it expired.
            </p>
            <Link className="btn btn--primary" to="/auth/forgot-password">
              Request reset link
            </Link>
            <Link className="linkish auth-mode-toggle" to="/auth">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
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
          <p className="tagline auth-tagline">Choose a new password</p>
          <form className="auth-form" onSubmit={submit}>
            <label className="field">
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                required
                minLength={6}
              />
            </label>
            {msg ? <p className="form-msg">{msg}</p> : null}
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : 'Update password'}
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
