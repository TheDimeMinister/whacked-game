import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AvatarMugshot } from '../components/AvatarMugshot'
import { CharacterPickerModal } from '../components/CharacterPickerModal'
import { TeamShieldBadge } from '../components/TeamShieldBadge'
import { useAuth } from '../providers/AuthProvider'
import { getPresetPortraitUrl } from '../lib/characterPresets'
import { resolveProfileAvatarUrl } from '../lib/resolveProfileAvatarUrl'
import {
  TEAM_SHIELD_OPTIONS,
  type TeamShieldKey,
  isTeamShieldKey,
} from '../lib/teamShields'
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
  const { supabase, user, updatePassword } = useAuth()
  const qc = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const [filedBanner, setFiledBanner] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)
  const [officeName, setOfficeName] = useState('')
  const [officeShield, setOfficeShield] = useState<TeamShieldKey>('vault')
  const [officeJoinCode, setOfficeJoinCode] = useState('')
  const [officeMsg, setOfficeMsg] = useState<string | null>(null)

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

  const teamQ = useQuery({
    queryKey: ['my_team', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('role, teams(id, name, shield_key, invite_code)')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const row = data as {
        role: string
        teams:
          | {
              id: string
              name: string
              shield_key: string
              invite_code: string
            }
          | null
          | Array<{
              id: string
              name: string
              shield_key: string
              invite_code: string
            }>
      }
      const t = row.teams
      const pack = Array.isArray(t) ? t[0] : t
      if (!pack) return null
      return {
        role: row.role as 'owner' | 'member',
        id: pack.id,
        name: pack.name,
        shield_key: pack.shield_key,
        invite_code: pack.invite_code,
      }
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
        .maybeSingle()
      if (error) throw error
      if (!data) {
        return {
          user_id: user!.id,
          wins: 0,
          losses: 0,
          total_whack_declarations: 0,
          successful_whacks: 0,
          weapon_counts: {},
          badges: [],
        } satisfies StatsRow
      }
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

  const createTeamMut = useMutation({
    mutationFn: async (payload: { name: string; shield: TeamShieldKey }) => {
      const { data, error } = await supabase.rpc('create_team', {
        p_name: payload.name,
        p_shield_key: payload.shield,
      })
      if (error) throw error
      return data as
        | { out_team_id: string; out_invite_code: string }
        | { out_team_id: string; out_invite_code: string }[]
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my_team'] })
      void qc.invalidateQueries({ queryKey: ['lobby_members'] })
    },
  })

  const joinTeamMut = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('join_team_by_invite', {
        p_invite_code: code,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my_team'] })
      void qc.invalidateQueries({ queryKey: ['lobby_members'] })
    },
  })

  const leaveTeamMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('leave_team')
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my_team'] })
      void qc.invalidateQueries({ queryKey: ['lobby_members'] })
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

  const socialCodenameHint = useMemo(
    () => Boolean(user?.identities?.some((i) => i.provider !== 'email')),
    [user?.identities],
  )

  if (!user) return null

  return (
    <div className="screen profile-screen">
      {socialCodenameHint ? (
        <p className="muted small profile-oauth-hint" style={{ margin: '0 0 0.65rem' }}>
          Signed in with Google, Discord, or Facebook? Set your <strong>codename</strong> under
          Amend dossier — it’s how you appear in rooms.
        </p>
      ) : null}

      {profileQ.data ? (
        <>
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

        <section className="office-card glass-surface" aria-labelledby="office-heading">
          <h2 id="office-heading">Office</h2>
          <p className="muted small" style={{ margin: '0 0 0.5rem' }}>
            Cosmetic guild badge — other operatives see it in the room list when you share a
            lobby.
          </p>
          {officeMsg ? <p className="form-msg">{officeMsg}</p> : null}
          {teamQ.isLoading ? (
            <p className="muted small">Loading office…</p>
          ) : teamQ.data ? (
            <>
              <div className="office-card__row">
                {isTeamShieldKey(teamQ.data.shield_key) ? (
                  <TeamShieldBadge
                    shieldKey={teamQ.data.shield_key}
                    title={teamQ.data.name}
                    size={36}
                  />
                ) : null}
                <div>
                  <strong>{teamQ.data.name}</strong>
                  <p className="muted small" style={{ margin: '0.15rem 0 0' }}>
                    {teamQ.data.role === 'owner' ? 'Owner' : 'Member'} · invite{' '}
                    <span className="mono">{teamQ.data.invite_code}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="linkish danger"
                disabled={leaveTeamMut.isPending}
                onClick={() => {
                  setOfficeMsg(null)
                  if (!window.confirm('Leave this office? You can create or join another later.'))
                    return
                  leaveTeamMut.mutate(undefined, {
                    onError: (e: Error) => setOfficeMsg(e.message),
                    onSuccess: () => {
                      setOfficeMsg('Left the office.')
                    },
                  })
                }}
              >
                {leaveTeamMut.isPending ? 'Leaving…' : 'Leave office'}
              </button>
            </>
          ) : (
            <>
              <label className="field">
                <span>New office name</span>
                <input
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="The Night Desk"
                  maxLength={48}
                />
              </label>
              <p className="muted small" style={{ margin: '0.25rem 0 0.15rem' }}>
                Shield (shown in lobbies)
              </p>
              <div className="office-shield-grid">
                {TEAM_SHIELD_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    className={`office-shield-opt ${officeShield === o.key ? 'office-shield-opt--on' : ''}`}
                    onClick={() => setOfficeShield(o.key)}
                  >
                    <TeamShieldBadge shieldKey={o.key} size={32} />
                    {o.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn--primary"
                disabled={createTeamMut.isPending || !officeName.trim()}
                onClick={() => {
                  setOfficeMsg(null)
                  createTeamMut.mutate(
                    { name: officeName.trim(), shield: officeShield },
                    {
                      onError: (e: Error) => setOfficeMsg(e.message),
                      onSuccess: (data) => {
                        const row = Array.isArray(data) ? data[0] : data
                        const code = row?.out_invite_code ?? '—'
                        setOfficeMsg(`Office created. Invite code: ${code}`)
                        setOfficeName('')
                      },
                    },
                  )
                }}
              >
                {createTeamMut.isPending ? 'Creating…' : 'Create office'}
              </button>
              <p className="auth-oauth-divider muted small" style={{ margin: '1rem 0 0.5rem' }}>
                or join with code
              </p>
              <label className="field">
                <span>Office invite code</span>
                <input
                  value={officeJoinCode}
                  onChange={(e) => setOfficeJoinCode(e.target.value)}
                  placeholder="ABC123"
                  autoCapitalize="characters"
                />
              </label>
              <button
                type="button"
                className="btn"
                disabled={joinTeamMut.isPending || !officeJoinCode.trim()}
                onClick={() => {
                  setOfficeMsg(null)
                  joinTeamMut.mutate(officeJoinCode.trim(), {
                    onError: (e: Error) => setOfficeMsg(e.message),
                    onSuccess: () => {
                      setOfficeMsg('Joined office.')
                      setOfficeJoinCode('')
                    },
                  })
                }}
              >
                {joinTeamMut.isPending ? 'Joining…' : 'Join office'}
              </button>
            </>
          )}
        </section>
        </>
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
