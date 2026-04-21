import type { Provider } from '@supabase/supabase-js'
import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { AvatarMugshot } from '../components/AvatarMugshot'
import { CharacterPickerModal } from '../components/CharacterPickerModal'
import { GoogleIcon } from '../components/OAuthBrandIcons'
import { RulesModal } from '../components/RulesModal'
import { CHARACTER_PRESETS, getPresetPortraitUrl } from '../lib/characterPresets'
import { useAuth } from '../providers/AuthProvider'

export function AuthScreen() {
  const { user, loading, signIn, signUp, signInWithOAuth } = useAuth()
  const [searchParams] = useSearchParams()
  const resetSuccess = searchParams.get('reset') === 'success'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [signupAvatarKey, setSignupAvatarKey] = useState<string | null>(null)
  const [codename, setCodename] = useState('')
  const [oauthBusy, setOauthBusy] = useState<Provider | null>(null)

  async function runOAuth(provider: Provider) {
    setMsg(null)
    setOauthBusy(provider)
    const { error } = await signInWithOAuth(provider)
    setOauthBusy(null)
    if (error) {
      const raw = error.message
      const lower = raw.toLowerCase()
      if (
        lower.includes('not enabled') ||
        lower.includes('unsupported provider') ||
        lower.includes('validation_failed')
      ) {
        setMsg(
          `${raw} — Turn on this provider in the Supabase dashboard: Authentication → Providers (add client id/secret and save).`,
        )
      } else {
        setMsg(raw)
      }
    }
  }

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
    if (mode === 'signup' && !codename.trim()) {
      setMsg('Enter a codename (how you appear in the field).')
      return
    }
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
            codename: codename.trim(),
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
          {resetSuccess ? (
            <p className="form-msg" role="status">
              Password updated. Sign in with your new password.
            </p>
          ) : null}
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
            {mode === 'signup' ? (
              <label className="field">
                <span>Codename</span>
                <input
                  value={codename}
                  onChange={(e) => setCodename(e.target.value)}
                  placeholder="How you appear in lobbies"
                  autoComplete="nickname"
                  maxLength={48}
                  required
                />
              </label>
            ) : null}
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
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
            </button>
            {mode === 'signin' ? (
              <Link className="linkish auth-forgot-link" to="/auth/forgot-password">
                Forgot password?
              </Link>
            ) : null}
          </form>
          {msg ? <p className="form-msg auth-form-msg">{msg}</p> : null}
          <p className="auth-oauth-divider muted small">Or continue with</p>
          <div className="auth-oauth-row" role="group" aria-label="Sign in with a social account">
            <button
              type="button"
              className="btn auth-oauth-btn auth-oauth-btn--google"
              disabled={!!oauthBusy}
              aria-label="Continue with Google"
              onClick={() => void runOAuth('google')}
            >
              <GoogleIcon className="auth-oauth-btn__icon" />
              <span className="auth-oauth-btn__label">
                {oauthBusy === 'google' ? 'Redirecting…' : 'Google'}
              </span>
            </button>
            {/* <button
              type="button"
              className="btn auth-oauth-btn auth-oauth-btn--discord"
              disabled={!!oauthBusy}
              aria-label="Continue with Discord"
              onClick={() => void runOAuth('discord')}
            >
              <DiscordIcon className="auth-oauth-btn__icon" />
              <span className="auth-oauth-btn__label">
                {oauthBusy === 'discord' ? 'Redirecting…' : 'Discord'}
              </span>
            </button>
            <button
              type="button"
              className="btn auth-oauth-btn auth-oauth-btn--facebook"
              disabled={!!oauthBusy}
              aria-label="Continue with Facebook"
              onClick={() => void runOAuth('facebook')}
            >
              <FacebookIcon className="auth-oauth-btn__icon" />
              <span className="auth-oauth-btn__label">
                {oauthBusy === 'facebook' ? 'Redirecting…' : 'Facebook'}
              </span>
            </button> */}
          </div>
          <button
            type="button"
            className="linkish auth-mode-toggle"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setMsg(null)
              setSignupAvatarKey(null)
              setCodename('')
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
