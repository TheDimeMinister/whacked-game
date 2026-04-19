import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvatarMugshot } from '../components/AvatarMugshot'
import { HoldReveal } from '../components/HoldReveal'
import { useAuth } from '../providers/AuthProvider'
import { useGameSession } from '../providers/GameSessionProvider'
import { useUiTone } from '../providers/UiToneProvider'

type GameRow = {
  id: string
  lobby_id: string
  status: 'active' | 'ended' | 'cancelled'
  winner_user_id: string | null
  ended_reason: string | null
  created_at: string
}

type AssignmentRow = {
  game_id: string
  user_id: string
  target_user_id: string
  weapon_id: string
}

type WeaponRow = { id: string; name: string; slug: string }

type WhackRow = {
  id: string
  game_id: string
  declarer_id: string
  target_user_id: string
  weapon_id: string
  status: string
}

type GameEventRow = {
  id: number
  game_id: string
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

type ProfileMini = { id: string; display_name: string | null }

type AdminDebugAssignment = {
  user_id: string
  target_user_id: string
  weapon_id: string
  weapon_slug: string
  weapon_name: string
  target_display_name: string | null
  declarer_is_bot: boolean
}

type AdminDebugMember = {
  user_id: string
  display_name: string
  ready: boolean
  is_test_bot: boolean
  joined_at?: string
}

type AdminDebugSnapshot = {
  game: Record<string, unknown>
  members: AdminDebugMember[]
  assignments: AdminDebugAssignment[]
  pending_whack: Record<string, unknown> | null
  recent_events: Array<{
    id: number
    event_type: string
    payload: Record<string, unknown>
    created_at: string
  }>
}

export type GamePanelProps = {
  gameId: string
  /** When true, hide header link back to lobby (combined room view). */
  embedded?: boolean
  /** From case closed / cancelled: return to room lobby (ready + host Start game). */
  onLeavePostGame?: () => void
}

export function GamePanel({
  gameId,
  embedded = false,
  onLeavePostGame,
}: GamePanelProps) {
  const { supabase, user } = useAuth()
  const { setActiveGameId } = useGameSession()
  const { setHeat } = useUiTone()
  const qc = useQueryClient()
  const [adminDebugOpen, setAdminDebugOpen] = useState(false)

  const profileSelfQ = useQuery({
    queryKey: ['my_profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('app_role')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as { app_role: string }
    },
  })

  const gameQ = useQuery({
    queryKey: ['game', gameId],
    enabled: !!gameId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games')
        .select('id, lobby_id, status, winner_user_id, ended_reason, created_at')
        .eq('id', gameId)
        .single()
      if (error) throw error
      return data as GameRow
    },
  })

  useEffect(() => {
    if (gameQ.data?.status !== 'active') return
    setHeat(true)
    return () => setHeat(false)
  }, [gameQ.data?.status, setHeat])

  const assignmentQ = useQuery({
    queryKey: ['assignment', gameId, user?.id],
    enabled: !!gameId && !!user && gameQ.data?.status === 'active',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments')
        .select('game_id, user_id, target_user_id, weapon_id')
        .eq('game_id', gameId)
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data as AssignmentRow | null
    },
  })

  const weaponIds = useMemo(() => {
    const ids = new Set<string>()
    if (assignmentQ.data?.weapon_id) ids.add(assignmentQ.data.weapon_id)
    return [...ids]
  }, [assignmentQ.data])

  const weaponsQ = useQuery({
    queryKey: ['weapons', weaponIds],
    enabled: weaponIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weapons')
        .select('id, name, slug')
        .in('id', weaponIds)
      if (error) throw error
      return (data ?? []) as WeaponRow[]
    },
  })

  const targetProfileQ = useQuery({
    queryKey: ['profile', assignmentQ.data?.target_user_id],
    enabled: !!assignmentQ.data?.target_user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', assignmentQ.data!.target_user_id)
        .single()
      if (error) throw error
      return data as ProfileMini
    },
  })

  const pendingWhackQ = useQuery({
    queryKey: ['pending_whack', gameId, user?.id],
    enabled: !!gameId && !!user && gameQ.data?.status === 'active',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whack_attempts')
        .select('id, game_id, declarer_id, target_user_id, weapon_id, status')
        .eq('game_id', gameId)
        .eq('status', 'pending_target')
        .or(`declarer_id.eq.${user!.id},target_user_id.eq.${user!.id}`)
        .maybeSingle()
      if (error) throw error
      return data as WhackRow | null
    },
    refetchInterval: 15_000,
  })

  const eventsQ = useQuery({
    queryKey: ['game_events', gameId],
    enabled: !!gameId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('game_events')
        .select('id, game_id, event_type, payload, created_at')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(40)
      if (error) throw error
      return (data ?? []) as GameEventRow[]
    },
  })

  const acceptedEvent = eventsQ.data?.find((e) => e.event_type === 'whack_accepted')

  const startedEvent = useMemo(
    () => eventsQ.data?.find((e) => e.event_type === 'game_started'),
    [eventsQ.data],
  )

  const caseElapsed = useMemo(() => {
    if (!acceptedEvent?.created_at || !gameQ.data) return null
    const end = new Date(acceptedEvent.created_at).getTime()
    const startIso = startedEvent?.created_at ?? gameQ.data.created_at
    const start = new Date(startIso).getTime()
    if (Number.isNaN(start) || Number.isNaN(end)) return null
    const ms = Math.max(0, end - start)
    const DAY = 86400000
    const days = Math.floor(ms / DAY)
    const rem = ms % DAY
    const totalSec = Math.floor(rem / 1000)
    const hh = String(Math.floor(totalSec / 3600)).padStart(2, '0')
    const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
    const ss = String(totalSec % 60).padStart(2, '0')
    return { days, clock: `${hh}:${mm}:${ss}` }
  }, [acceptedEvent, startedEvent, gameQ.data])

  const revealIds = useMemo(() => {
    if (!acceptedEvent?.payload) return [] as string[]
    const p = acceptedEvent.payload as {
      whacker_id?: string
      victim_id?: string
    }
    const ids = [p.whacker_id, p.victim_id].filter(Boolean) as string[]
    return ids
  }, [acceptedEvent])

  const revealProfilesQ = useQuery({
    queryKey: ['reveal_profiles', revealIds],
    enabled: revealIds.length === 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', revealIds)
      if (error) throw error
      const map: Record<string, string> = {}
      for (const row of (data ?? []) as ProfileMini[]) {
        map[row.id] = row.display_name ?? 'Unknown'
      }
      return map
    },
  })

  const lobbyMiniQ = useQuery({
    queryKey: ['lobby_host', gameQ.data?.lobby_id],
    enabled: !!gameQ.data?.lobby_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lobbies')
        .select('id, host_id')
        .eq('id', gameQ.data!.lobby_id)
        .single()
      if (error) throw error
      return data as { id: string; host_id: string }
    },
  })

  const isAdminHost =
    profileSelfQ.data?.app_role === 'admin' &&
    lobbyMiniQ.data?.host_id === user?.id

  const adminSnapQ = useQuery({
    queryKey: ['admin_debug_game', gameId],
    enabled:
      !!gameId &&
      !!user &&
      gameQ.data?.status === 'active' &&
      isAdminHost &&
      adminDebugOpen,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'admin_debug_game_snapshot' as never,
        { p_game_id: gameId } as never,
      )
      if (error) throw error
      return data as AdminDebugSnapshot
    },
    refetchInterval: adminDebugOpen ? 8000 : false,
  })

  const adminBotDeclareMut = useMutation({
    mutationFn: async (botUserId: string) => {
      const { data, error } = await supabase.rpc(
        'admin_bot_declare_whack' as never,
        { p_game_id: gameId, p_bot_user_id: botUserId } as never,
      )
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pending_whack', gameId] })
      void qc.invalidateQueries({ queryKey: ['game_events', gameId] })
      void qc.invalidateQueries({ queryKey: ['admin_debug_game', gameId] })
    },
  })

  const adminBotRespondMut = useMutation({
    mutationFn: async (opts: {
      attemptId: string
      accept: boolean
      targetBotUserId: string
    }) => {
      const { error } = await supabase.rpc(
        'admin_bot_respond_whack' as never,
        {
          p_attempt_id: opts.attemptId,
          p_accept: opts.accept,
          p_target_bot_user_id: opts.targetBotUserId,
        } as never,
      )
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pending_whack', gameId] })
      void qc.invalidateQueries({ queryKey: ['game', gameId] })
      void qc.invalidateQueries({ queryKey: ['game_events', gameId] })
      void qc.invalidateQueries({ queryKey: ['admin_debug_game', gameId] })
    },
  })

  useEffect(() => {
    if (!gameId || !user) return
    const ch = supabase
      .channel(`gamefeed:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_events',
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['game_events', gameId] })
          void qc.invalidateQueries({ queryKey: ['admin_debug_game', gameId] })
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          void qc.invalidateQueries({ queryKey: ['game', gameId] })
          void qc.invalidateQueries({ queryKey: ['admin_debug_game', gameId] })
          const lid = (payload.new as { lobby_id?: string })?.lobby_id
          if (lid) {
            void qc.invalidateQueries({ queryKey: ['lobby_latest_game', lid] })
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whack_attempts',
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['pending_whack', gameId] })
          void qc.invalidateQueries({ queryKey: ['admin_debug_game', gameId] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [gameId, qc, supabase, user])

  const banner = useMemo(() => {
    const top = eventsQ.data?.[0]
    if (!top) return null
    if (top.event_type === 'whack_declared') {
      return 'Contract is in the air — someone filed a hit.'
    }
    if (top.event_type === 'whack_declined') {
      const w = (top.payload as { weapon_name?: string }).weapon_name
      return `Heat fizzled — piece was: ${w ?? 'unknown'}`
    }
    if (top.event_type === 'whack_accepted') {
      const p = top.payload as { weapon_name?: string }
      return `Case closed — winning piece: ${p.weapon_name ?? '?'}`
    }
    if (top.event_type === 'game_started') {
      return 'Operation live. Watch your back.'
    }
    return null
  }, [eventsQ.data])

  const declareMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('declare_whack', {
        p_game_id: gameId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pending_whack', gameId] })
      void qc.invalidateQueries({ queryKey: ['game_events', gameId] })
    },
  })

  const respondMut = useMutation({
    mutationFn: async (accept: boolean) => {
      const { error } = await supabase.rpc('respond_whack', {
        p_attempt_id: pendingWhackQ.data!.id,
        p_accept: accept,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pending_whack', gameId] })
      void qc.invalidateQueries({ queryKey: ['game', gameId] })
      void qc.invalidateQueries({ queryKey: ['game_events', gameId] })
    },
  })

  const myWeapon = weaponsQ.data?.find((w) => w.id === assignmentQ.data?.weapon_id)

  const isTarget =
    pendingWhackQ.data &&
    pendingWhackQ.data.target_user_id === user?.id &&
    pendingWhackQ.data.status === 'pending_target'

  if (gameQ.isLoading) {
    return (
      <div className="screen">
        <p className="muted">Opening file…</p>
      </div>
    )
  }

  if (gameQ.isError || !gameQ.data) {
    return (
      <div className="screen">
        <p className="error">Game not found or access denied.</p>
        <button type="button" className="btn" onClick={() => setActiveGameId(null)}>
          Clear session
        </button>
        {!embedded ? (
          <Link to="/app/lobby" className="btn btn--primary">
            Room
          </Link>
        ) : null}
      </div>
    )
  }

  if (gameQ.data.status !== 'active') {
    const p = acceptedEvent?.payload as
      | {
          whacker_id?: string
          victim_id?: string
          weapon_name?: string
        }
      | undefined
    const whackerName =
      p?.whacker_id && revealProfilesQ.data
        ? revealProfilesQ.data[p.whacker_id]
        : undefined
    const victimName =
      p?.victim_id && revealProfilesQ.data
        ? revealProfilesQ.data[p.victim_id]
        : undefined
    const hitterLabel = whackerName ?? '…'
    const targetLabel = victimName ?? '…'

    return (
      <div className="screen game-screen case-file case-closed">
        <p className="case-file__title">After-action report</p>
        <h1 className="case-file__headline">Case closed</h1>
        {acceptedEvent && p ? (
          <section className="card reveal-card case-closed-card">
            <div className="case-closed-stack">
              <div className="case-mug case-winner">
                <p className="role">Winner</p>
                <AvatarMugshot label={hitterLabel} size={96} />
                <p className="case-name">
                  <strong>{hitterLabel}</strong>
                  {p.whacker_id === user?.id ? ' (you)' : ''}
                </p>
              </div>

              <div className="case-mug case-kia">
                <AvatarMugshot label={targetLabel} size={96} />
                <p className="case-eliminated">Eliminated</p>
                <p className="case-weapon">
                  <span className="muted">Piece used</span>
                  <br />
                  <strong>{p.weapon_name ?? '?'}</strong>
                </p>
                <p className="case-name case-name--target">
                  <strong>{targetLabel}</strong>
                  {p.victim_id === user?.id ? ' (you)' : ''}
                </p>
              </div>
            </div>

            {caseElapsed ? (
              <div className="case-time">
                <p className="muted small">Time on the street</p>
                <p className="case-time-clock">{caseElapsed.clock}</p>
                {caseElapsed.days > 0 ? (
                  <div className="case-tally-row case-tally-row--center">
                    <span className="muted small">Day marks</span>
                    <span
                      className="case-tally-marks"
                      aria-label={`${caseElapsed.days} days`}
                    >
                      {Array.from(
                        { length: Math.min(caseElapsed.days, 28) },
                        (_, i) => (
                          <span key={i} className="tally-stroke">
                            |
                          </span>
                        ),
                      )}
                      {caseElapsed.days > 28 ? (
                        <span className="muted small"> +{caseElapsed.days - 28}</span>
                      ) : null}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
        <div className="btn-row case-file__actions">
          {onLeavePostGame ? (
            <>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onLeavePostGame()}
              >
                Play again
              </button>
              <p className="muted small">
                You&apos;ll return to the room to ready up. The host starts the next
                game from there when there are enough players.
              </p>
            </>
          ) : !embedded ? (
            <Link
              to={`/app/lobby/${gameQ.data.lobby_id}`}
              className="btn btn--primary"
            >
              Back to room
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="screen game-screen">
      <header className="game-header">
        <p className="muted">Whacked!</p>
        {!embedded ? (
          <Link to={`/app/lobby/${gameQ.data.lobby_id}`} className="linkish small">
            Room
          </Link>
        ) : (
          <span className="muted small">In this room</span>
        )}
      </header>

      {banner ? <p className="banner subtle">{banner}</p> : null}

      <section className="card targets">
        <HoldReveal label="Your piece" className="hold-reveal--compact">
          <span className="reveal-line">{myWeapon?.name ?? '…'}</span>
        </HoldReveal>
        <HoldReveal label="Your mark" className="hold-reveal--compact">
          <span className="reveal-line">
            {targetProfileQ.data?.display_name ?? 'Unknown'}
          </span>
        </HoldReveal>
      </section>

      <div className="whack-wrap">
        <button
          type="button"
          className="whack-btn"
          onClick={() => declareMut.mutate()}
          disabled={
            declareMut.isPending ||
            !!pendingWhackQ.data ||
            !assignmentQ.data
          }
        >
          {declareMut.isPending ? '…' : 'Whacked!'}
        </button>
        <p className="muted small center">
          Declare only after the handoff in real life.
        </p>
      </div>

      {isTarget ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h2>They filed on you?</h2>
            <p className="muted">Someone says the piece landed. Your call.</p>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => respondMut.mutate(true)}
                disabled={respondMut.isPending}
              >
                Accept
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => respondMut.mutate(false)}
                disabled={respondMut.isPending}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingWhackQ.data?.declarer_id === user?.id &&
      pendingWhackQ.data?.status === 'pending_target' ? (
        <p className="muted center">Waiting on your mark to answer…</p>
      ) : null}

      {isAdminHost ? (
        <details
          className="card admin-debug"
          onToggle={(e) => {
            setAdminDebugOpen((e.target as HTMLDetailsElement).open)
          }}
        >
          <summary>Admin debug (host)</summary>
          {adminDebugOpen && adminSnapQ.isLoading ? (
            <p className="muted">Loading snapshot…</p>
          ) : null}
          {adminSnapQ.isError ? (
            <p className="error">{(adminSnapQ.error as Error).message}</p>
          ) : null}
          {adminSnapQ.data ? (
            <>
              <h3 className="muted small">Assignments</h3>
              <div className="debug-table-wrap">
                <table className="debug-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Bot</th>
                      <th>Weapon</th>
                      <th>Target</th>
                      <th>Debug</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminSnapQ.data.assignments?.map((a) => {
                      const pending = adminSnapQ.data!.pending_whack as {
                        id?: string
                        declarer_id?: string
                        target_user_id?: string
                      } | null
                      const hasPending = Boolean(pending?.id)
                      const rowMember = adminSnapQ.data!.members.find(
                        (m) => m.user_id === a.user_id,
                      )
                      const isRowBot = Boolean(rowMember?.is_test_bot)
                      return (
                        <tr key={a.user_id}>
                          <td className="mono small">
                            {rowMember?.display_name ?? a.user_id.slice(0, 8)}
                          </td>
                          <td>{isRowBot ? 'yes' : 'no'}</td>
                          <td>
                            {a.weapon_name}
                            <span className="muted small"> ({a.weapon_slug})</span>
                          </td>
                          <td>
                            {a.target_display_name ?? '—'}
                            <span className="mono small">
                              {' '}
                              ({a.target_user_id.slice(0, 8)}…)
                            </span>
                          </td>
                          <td>
                            {isRowBot && hasPending &&
                            pending!.declarer_id === a.user_id ? (
                              <span className="muted small">Awaiting target</span>
                            ) : null}
                            {isRowBot && !hasPending ? (
                              <button
                                type="button"
                                className="btn"
                                disabled={adminBotDeclareMut.isPending}
                                onClick={() => adminBotDeclareMut.mutate(a.user_id)}
                              >
                                Bot declare
                              </button>
                            ) : null}
                            {hasPending &&
                            pending!.target_user_id === a.user_id &&
                            isRowBot &&
                            pending!.id ? (
                              <div className="btn-row">
                                <button
                                  type="button"
                                  className="btn btn--primary"
                                  disabled={adminBotRespondMut.isPending}
                                  onClick={() =>
                                    adminBotRespondMut.mutate({
                                      attemptId: pending!.id!,
                                      accept: true,
                                      targetBotUserId: a.user_id,
                                    })
                                  }
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  className="btn"
                                  disabled={adminBotRespondMut.isPending}
                                  onClick={() =>
                                    adminBotRespondMut.mutate({
                                      attemptId: pending!.id!,
                                      accept: false,
                                      targetBotUserId: a.user_id,
                                    })
                                  }
                                >
                                  Decline
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <h3 className="muted small">Lobby members (snapshot)</h3>
              <ul className="member-list">
                {adminSnapQ.data.members?.map((m) => (
                  <li key={m.user_id} className="mono small">
                    {m.display_name} — ready: {m.ready ? 'yes' : 'no'} — bot:{' '}
                    {m.is_test_bot ? 'yes' : 'no'}
                  </li>
                ))}
              </ul>
              <h3 className="muted small">Pending whack (raw)</h3>
              <pre className="debug-pre">
                {JSON.stringify(adminSnapQ.data.pending_whack, null, 2)}
              </pre>
              <h3 className="muted small">Recent events</h3>
              <ul className="member-list">
                {adminSnapQ.data.recent_events?.slice(0, 8).map((ev) => (
                  <li key={ev.id} className="mono small">
                    {ev.event_type}{' '}
                    <span className="muted">
                      {new Date(ev.created_at).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : adminDebugOpen ? (
            <p className="muted">No data yet.</p>
          ) : null}
        </details>
      ) : null}
    </div>
  )
}
