import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef } from 'react'
import { useAuth } from '../providers/AuthProvider'
import { TITLE_OPTIONS } from '../lib/titles'

type ProfileRow = {
  id: string
  display_name: string | null
  equipped_title_id: string | null
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

export function ProfileScreen() {
  const { supabase, user } = useAuth()
  const qc = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)

  const profileQ = useQuery({
    queryKey: ['profile_me', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, equipped_title_id, updated_at')
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
      const { data, error } = await supabase
        .from('weapons')
        .select('id, name')
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
    },
  })

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

  const formKey = profileQ.data?.updated_at ?? profileQ.data?.id ?? 'profile'

  if (!user) return null

  return (
    <div className="screen profile-screen">
      <h1>Profile</h1>
      <section className="card">
        <h2>Identity</h2>
        {profileQ.data ? (
          <form
            key={formKey}
            ref={formRef}
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault()
              saveMut.mutate()
            }}
          >
            <label className="field">
              <span>Display name</span>
              <input
                name="display_name"
                defaultValue={profileQ.data.display_name ?? ''}
              />
            </label>
            <label className="field">
              <span>Title</span>
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
            <button className="btn btn--primary" type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        ) : (
          <p className="muted">Loading profile…</p>
        )}
      </section>

      <section className="card">
        <h2>Stats</h2>
        <ul className="stat-grid">
          <li>
            <span className="stat-label">Wins</span>
            <span className="stat-value">{statsQ.data?.wins ?? 0}</span>
          </li>
          <li>
            <span className="stat-label">Losses</span>
            <span className="stat-value">{statsQ.data?.losses ?? 0}</span>
          </li>
          <li>
            <span className="stat-label">Whack declarations</span>
            <span className="stat-value">
              {statsQ.data?.total_whack_declarations ?? 0}
            </span>
          </li>
          <li>
            <span className="stat-label">Successful whacks</span>
            <span className="stat-value">
              {statsQ.data?.successful_whacks ?? 0}
            </span>
          </li>
          <li>
            <span className="stat-label">Attempt success</span>
            <span className="stat-value">{attemptRate}</span>
          </li>
          <li>
            <span className="stat-label">Win / (W+L)</span>
            <span className="stat-value">{killRate}</span>
          </li>
          <li>
            <span className="stat-label">Favourite weapon</span>
            <span className="stat-value">{favourite ?? '—'}</span>
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Badges</h2>
        <p className="muted small">
          {Array.isArray(statsQ.data?.badges) && statsQ.data!.badges.length
            ? (statsQ.data!.badges as string[]).join(', ')
            : 'None yet — get your first accepted whack.'}
        </p>
      </section>
    </div>
  )
}
