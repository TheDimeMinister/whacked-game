import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AvatarMugshot } from '../components/AvatarMugshot'
import { CharacterPickerModal } from '../components/CharacterPickerModal'
import { useAuth } from '../providers/AuthProvider'
import { getPresetPortraitUrl } from '../lib/characterPresets'
import { resolveProfileAvatarUrl } from '../lib/resolveProfileAvatarUrl'
import { TITLE_OPTIONS } from '../lib/titles'

type ProfileRow = {
  id: string
  display_name: string | null
  equipped_title_id: string | null
  avatar_key: string | null
  updated_at?: string
}

type StatsRow = {
  user_id: string
  wins: number
  losses: number
  total_whack_declarations: number
  successful_whacks: number
  weapon_counts: Record<string, number> | null
  badges: unknown
}

const DOSSIER_MUGSHOT_PX = 96

export function ProfileScreen() {
  const { supabase, user, signOut, updatePassword } = useAuth()
  const qc = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [filedBanner, setFiledBanner] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)

  const profileQ = useQuery({
    queryKey: ['profile_me', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, equipped_title_id, avatar_key, updated_at')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as ProfileRow
    },
  })

  const statsQ = useQuery({
    queryKey: ['stats_me', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_stats')
        .select(
          'user_id, wins, losses, total_whack_declarations, successful_whacks, weapon_counts, badges',
        )
        .eq('user_id', user!.id)
        .single()
      if (error) throw error
      return data as StatsRow
    },
  })

  const weaponsQ = useQuery({
    queryKey: ['all_weapons_labels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('weapons').select('id, name')
      if (error) throw error
      return (data ?? []) as { id: string; name: string }[]
    },
  })

  const saveMut = useMutation({
    mutationFn: async () => {
      const el = formRef.current
      if (!el) return
      const fd = new FormData(el)
      const display_name = String(fd.get('display_name') ?? '').trim()
      const equipped_title_id = String(fd.get('equipped_title_id') ?? '').trim()
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: display_name || null,
          equipped_title_id: equipped_title_id || null,
        })
        .eq('id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile_me'] })
      setFiledBanner(true)
    },
  })

  const avatarMut = useMutation({
    mutationFn: async (avatarKey: string) => {
      const src = getPresetPortraitUrl(avatarKey)
      if (!src) throw new Error('Unknown portrait')
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ avatar_key: avatarKey })
        .eq('id', user!.id)
      if (pErr) throw pErr
      const { error: aErr } = await supabase.auth.updateUser({
        data: { avatar_url: src },
      })
      if (aErr) throw aErr
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile_me', user?.id] })
    },
  })

  useEffect(() => {
    if (!filedBanner) return
    const t = window.setTimeout(() => {
      setFiledBanner(false)
      saveMut.reset()
    }, 2200)
    return () => window.clearTimeout(t)
  }, [filedBanner, saveMut])

  const favourite = useMemo(() => {
    const wc = statsQ.data?.weapon_counts
    if (!wc || !weaponsQ.data?.length) return null
    let bestId: string | null = null
    let best = 0
    for (const [id, n] of Object.entries(wc)) {
      const c = typeof n === 'number' ? n : Number(n)
      if (c > best) {
        best = c
        bestId = id
      }
    }
    if (!bestId) return null
    return weaponsQ.data.find((w) => w.id === bestId)?.name ?? bestId
  }, [statsQ.data?.weapon_counts, weaponsQ.data])

  const attemptRate = useMemo(() => {
    const t = statsQ.data?.total_whack_declarations ?? 0
    const s = statsQ.data?.successful_whacks ?? 0
    if (t === 0) return '—'
    return `${Math.round((s / t) * 100)}%`
  }, [statsQ.data])

  const killRate = useMemo(() => {
    const w = statsQ.data?.wins ?? 0
    const l = statsQ.data?.losses ?? 0
    const d = w + l
    if (d === 0) return '—'
    return `${Math.round((w / d) * 100)}%`
  }, [statsQ.data])

  const equippedTitleLabel = useMemo(() => {
    const id = profileQ.data?.equipped_title_id ?? TITLE_OPTIONS[0].id
    return TITLE_OPTIONS.find((t) => t.id === id)?.label ?? 'Unknown'
  }, [profileQ.data?.equipped_title_id])

  const clearance = useMemo(() => {
    const w = statsQ.data?.wins ?? 0
    if (w >= 20) return 'Level V clearance'
    if (w >= 10) return 'Level IV clearance'
    if (w >= 5) return 'Level III clearance'
    if (w >= 1) return 'Level II clearance'
    return 'Probationary asset'
  }, [statsQ.data?.wins])

  const badgeList = useMemo(() => {
    const b = statsQ.data?.badges
    if (!Array.isArray(b)) return [] as string[]
    return b.filter((x): x is string => typeof x === 'string')
  }, [statsQ.data?.badges])

  const avatarUrl = resolveProfileAvatarUrl(profileQ.data?.avatar_key, user)
  const codename =
    profileQ.data?.display_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Unknown'

  const formKey = profileQ.data?.updated_at ?? profileQ.data?.id ?? 'profile'

  if (!user) return null

  return (
    <div className="screen profile-screen">
      <header className="profile-screen__head">
        <h1>Dossier</h1>
        <button
          type="button"
          className="profile-logout-btn"
          aria-label="Sign out"
          onClick={() => void signOut()}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </header>

      {profileQ.data ? (
        <div
          className="dossier-card glass-surface"
          style={{ ['--dossier-mug-size' as string]: `${DOSSIER_MUGSHOT_PX}px` }}
        >
          <span className="dossier-confidential" aria-hidden="true">
            CONFIDENTIAL
          </span>
          <div className="dossier-card__stack">
            <div className="dossier-top">
            <div className="dossier-photo-wrap">
              <button
                type="button"
                className="dossier-photo-btn"
                aria-label="Change operative portrait"
                disabled={avatarMut.isPending}
                onClick={() => setPickerOpen(true)}
              >
                <AvatarMugshot
                  url={avatarUrl}
                  label={codename}
                  size={DOSSIER_MUGSHOT_PX}
                />
              </button>
            </div>
            <div className="dossier-meta">
              <p className="dossier-clearance">{clearance}</p>
              <h2 className="dossier-codename">{codename}</h2>
              <p className="dossier-title-line">Street name: {equippedTitleLabel}</p>
            </div>
            </div>
            {avatarMut.isError ? (
              <p className="error small" style={{ marginTop: '0.35rem' }}>
                Could not update portrait.
              </p>
            ) : null}

            <div className="dossier-tallies">
            <div className="dossier-tally">
              <span>Hits filed</span>
              <strong>{statsQ.data?.successful_whacks ?? 0}</strong>
            </div>
            <div className="dossier-tally">
              <span>Contracts floated</span>
              <strong>{statsQ.data?.total_whack_declarations ?? 0}</strong>
            </div>
            <div className="dossier-tally">
              <span>Heat index</span>
              <strong>{attemptRate}</strong>
            </div>
            <div className="dossier-tally">
              <span>Jobs closed (W)</span>
              <strong>{statsQ.data?.wins ?? 0}</strong>
            </div>
            <div className="dossier-tally">
              <span>Slips (L)</span>
              <strong>{statsQ.data?.losses ?? 0}</strong>
            </div>
            <div className="dossier-tally">
              <span>Win rate</span>
              <strong>{killRate}</strong>
            </div>
            <div className="dossier-tally" style={{ minWidth: '7rem' }}>
              <span>Preferred piece</span>
              <strong>{favourite ?? '—'}</strong>
            </div>
            </div>

            <div className="dossier-badges">
            {badgeList.length ? (
              badgeList.map((b) => (
                <span key={b} className="dossier-stamp">
                  {b}
                </span>
              ))
            ) : (
              <span className="dossier-stamp">No stamps yet</span>
            )}
            </div>

            <details className="dossier-amend card">
            <summary>Amend dossier</summary>
            <form
              key={formKey}
              ref={formRef}
              className="auth-form"
              style={{ marginTop: '0.75rem' }}
              onSubmit={(e) => {
                e.preventDefault()
                saveMut.mutate()
              }}
            >
              <label className="field">
                <span>Codename</span>
                <input
                  name="display_name"
                  defaultValue={profileQ.data.display_name ?? ''}
                />
              </label>
              <label className="field">
                <span>Street name</span>
                <select
                  name="equipped_title_id"
                  defaultValue={
                    profileQ.data.equipped_title_id ?? TITLE_OPTIONS[0].id
                  }
                >
                  {TITLE_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="btn-row" style={{ alignItems: 'center' }}>
                <button
                  className="btn btn--primary btn--compact"
                  type="submit"
                  disabled={saveMut.isPending}
                >
                  {saveMut.isPending ? 'Filing…' : 'File changes'}
                </button>
                {filedBanner ? (
                  <span className="dossier-filed" aria-live="polite">
                    Filed
                  </span>
                ) : null}
              </div>
              {saveMut.isError ? (
                <p className="error">Bureau rejected the filing. Try again.</p>
              ) : null}
            </form>
            </details>

            <details className="dossier-amend card">
              <summary>Change password</summary>
              <form
                className="auth-form"
                style={{ marginTop: '0.75rem' }}
                onSubmit={async (e) => {
                  e.preventDefault()
                  setPwMsg(null)
                  const fd = new FormData(e.currentTarget)
                  const next = String(fd.get('new_password') ?? '')
                  const again = String(fd.get('new_password_confirm') ?? '')
                  if (next.length < 6) {
                    setPwMsg('Password must be at least 6 characters.')
                    return
                  }
                  if (next !== again) {
                    setPwMsg('Passwords do not match.')
                    return
                  }
                  setPwBusy(true)
                  const { error } = await updatePassword(next)
                  setPwBusy(false)
                  if (error) setPwMsg(error.message)
                  else {
                    setPwMsg('Password updated.')
                    e.currentTarget.reset()
                  }
                }}
              >
                <label className="field">
                  <span>New password</span>
                  <input
                    name="new_password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                </label>
                <label className="field">
                  <span>Confirm new password</span>
                  <input
                    name="new_password_confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                </label>
                {pwMsg ? <p className="form-msg">{pwMsg}</p> : null}
                <button
                  className="btn btn--primary btn--compact"
                  type="submit"
                  disabled={pwBusy}
                >
                  {pwBusy ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </details>
          </div>
        </div>
      ) : (
        <p className="muted">Decrypting dossier…</p>
      )}
      <CharacterPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(id) => avatarMut.mutate(id)}
        title="Operative portrait"
      />
    </div>
  )
}
