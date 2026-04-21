import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { AvatarMugshot } from '../components/AvatarMugshot'
import { TeamShieldBadge } from '../components/TeamShieldBadge'
import { resolveProfileAvatarUrl } from '../lib/resolveProfileAvatarUrl'
import { isTeamShieldKey } from '../lib/teamShields'
import { TITLE_OPTIONS } from '../lib/titles'
import { useAuth } from '../providers/AuthProvider'

export type LeaderboardSort = 'kills' | 'kd' | 'wins'

type LeaderboardRow = {
  rank: number
  user_id: string
  codename: string
  avatar_key: string | null
  equipped_title_id: string | null
  wins: number
  losses: number
  kills: number
  kd: number
  favourite_weapon_name: string | null
  office_name: string | null
  office_shield_key: string | null
}

function titleLabel(id: string | null | undefined): string {
  const x = id ?? TITLE_OPTIONS[0].id
  return TITLE_OPTIONS.find((t) => t.id === x)?.label ?? 'Unknown'
}

function pct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n * 100)}%`
}

export function LeaderboardScreen() {
  const { supabase } = useAuth()
  const [sort, setSort] = useState<LeaderboardSort>('kills')

  const lbQ = useQuery({
    queryKey: ['leaderboard', sort],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_global_leaderboard', {
        p_sort: sort,
        p_limit: 100,
      })
      if (error) throw error
      const rows = (Array.isArray(data) ? data : []) as Record<string, unknown>[]
      return rows.map((r) => ({
        rank: Number(r.rank),
        user_id: String(r.user_id),
        codename: String(r.codename ?? '—'),
        avatar_key: (r.avatar_key as string | null) ?? null,
        equipped_title_id: (r.equipped_title_id as string | null) ?? null,
        wins: Number(r.wins ?? 0),
        losses: Number(r.losses ?? 0),
        kills: Number(r.kills ?? 0),
        kd: Number(r.kd ?? 0),
        favourite_weapon_name: (r.favourite_weapon_name as string | null) ?? null,
        office_name: (r.office_name as string | null) ?? null,
        office_shield_key: (r.office_shield_key as string | null) ?? null,
      })) as LeaderboardRow[]
    },
  })

  const sortTabs = useMemo(
    () =>
      [
        { id: 'kills' as const, label: 'Hits filed' },
        { id: 'kd' as const, label: 'Win rate' },
        { id: 'wins' as const, label: 'Jobs closed' },
      ] satisfies { id: LeaderboardSort; label: string }[],
    [],
  )

  return (
    <div className="screen leaderboard-screen">
      <header className="lobby-screen__head glass-surface">
        <h1>Worldwide</h1>
      </header>

      <div className="leaderboard-toolbar glass-surface">
        <p className="muted small" style={{ margin: '0 0 0.5rem' }}>
          Rankings by bureau stats — top three are marked worldwide.
        </p>
        <div className="leaderboard-sort" role="tablist" aria-label="Sort leaderboard">
          {sortTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={sort === t.id}
              className={`leaderboard-sort__btn ${sort === t.id ? 'leaderboard-sort__btn--on' : ''}`}
              onClick={() => setSort(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {lbQ.isLoading ? (
        <p className="muted">Pulling global standings…</p>
      ) : lbQ.isError ? (
        <p className="error">Could not load leaderboard.</p>
      ) : !lbQ.data?.length ? (
        <p className="muted">No operatives on file yet.</p>
      ) : (
        <ol className="leaderboard-list">
          {lbQ.data.map((row) => {
            const tier =
              row.rank === 1 ? 'gold' : row.rank === 2 ? 'silver' : row.rank === 3 ? 'bronze' : ''
            const mug = resolveProfileAvatarUrl(row.avatar_key, null)
            return (
              <li
                key={row.user_id}
                className={`leaderboard-row ${tier ? `leaderboard-row--${tier}` : ''}`.trim()}
              >
                <div className="leaderboard-rankcol">
                  <span className="leaderboard-ranknum" aria-hidden>
                    {row.rank}
                  </span>
                  {row.rank <= 3 ? (
                    <span className="leaderboard-worldwide">
                      #{row.rank} worldwide
                    </span>
                  ) : null}
                </div>
                <AvatarMugshot
                  url={mug}
                  label={row.codename}
                  size={52}
                  className="leaderboard-mug"
                />
                <div className="leaderboard-body">
                  <div className="leaderboard-nameblock">
                    <strong className="leaderboard-codename">{row.codename}</strong>
                    <span className="leaderboard-street pill">
                      {titleLabel(row.equipped_title_id)}
                    </span>
                  </div>
                  <div className="leaderboard-meta">
                    <span>
                      Hits: <strong>{row.kills}</strong>
                    </span>
                    <span>
                      Win rate: <strong>{pct(row.kd)}</strong>
                    </span>
                    <span>
                      W / L:{' '}
                      <strong>
                        {row.wins} / {row.losses}
                      </strong>
                    </span>
                    {row.favourite_weapon_name ? (
                      <span className="leaderboard-piece">
                        Piece: <strong>{row.favourite_weapon_name}</strong>
                      </span>
                    ) : null}
                    {row.office_name ? (
                      <span className="leaderboard-office">
                        {row.office_shield_key && isTeamShieldKey(row.office_shield_key) ? (
                          <TeamShieldBadge
                            shieldKey={row.office_shield_key}
                            title={row.office_name}
                            size={22}
                          />
                        ) : null}
                        <strong>{row.office_name}</strong>
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
