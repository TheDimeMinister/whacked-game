import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AvatarMugshot } from '../components/AvatarMugshot'
import { CharacterPickerModal } from '../components/CharacterPickerModal'
import { RulesModal } from '../components/RulesModal'
import { CHARACTER_PRESETS, getPresetPortraitUrl } from '../lib/characterPresets'
import { useAuth } from '../providers/AuthProvider'

export function AuthScreen() {
  const { user, loading, signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [signupAvatarKey, setSignupAvatarKey] = useState<string | null>(null)

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
    if (
      mode === 'signup' &&
      CHARACTER_PRESETS.length > 0 &&
      !signupAvatarKey
    ) {
      setMsg('Choose your operative portrait before signing up.')
      return
    }
    setBusy(true)
    const { error } =
      mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, {
            avatarKey: signupAvatarKey ?? undefined,
          })
    setBusy(false)
    if (error) setMsg(error.message)
    else if (mode === 'signup')
      setMsg('Check your email to confirm, or sign in if already confirmed.')
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
            <button
              type="button"
              className="linkish auth-rules-btn"
              aria-label="Open field manual"
              onClick={() => setRulesOpen(true)}
            >
              ?
            </button>
          </div>
        </header>
        <div className="auth-screen__panel">
          <p className="tagline auth-tagline">Real-world stealth. Minimal evidence.</p>
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
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
            {mode === 'signup' && CHARACTER_PRESETS.length > 0 ? (
              <div className="auth-character-row">
                <button
                  type="button"
                  className="dossier-photo-btn"
                  aria-label="Choose operative portrait"
                  onClick={() => setPickerOpen(true)}
                >
                  <AvatarMugshot
                    url={getPresetPortraitUrl(signupAvatarKey ?? undefined)}
                    label={email.trim() || 'Operative'}
                    size={64}
                  />
                </button>
                <p className="muted">
                  {signupAvatarKey
                    ? 'Tap the portrait to change your look.'
                    : 'Tap the portrait to choose your look.'}
                </p>
              </div>
            ) : null}
            {msg ? <p className="form-msg">{msg}</p> : null}
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
          </form>
          <button
            type="button"
            className="linkish auth-mode-toggle"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setMsg(null)
              setSignupAvatarKey(null)
            }}
          >
            {mode === 'signin'
              ? 'Need an account? Sign up'
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <CharacterPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(id) => setSignupAvatarKey(id)}
        title="Choose your look"
      />
    </div>
  )
}
