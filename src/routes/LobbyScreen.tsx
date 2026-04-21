import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RulesModal } from '../components/RulesModal'
import { TeamShieldBadge } from '../components/TeamShieldBadge'
import { isTeamShieldKey } from '../lib/teamShields'
import { useAuth } from '../providers/AuthProvider'
import { useGameSession } from '../providers/GameSessionProvider'
import { GamePanel } from './GamePanel'

type LatestGameRow = {
  id: string
  lobby_id: string
  status: 'active' | 'ended' | 'cancelled'
  winner_user_id: string | null
  ended_reason: string | null
}

type WeaponPackRow = {
  id: string
  slug: string
  name: string
  description: string | null
  is_mature: boolean
  sort_order: number
}

type LobbyRow = {
  id: string
  invite_code: string
  host_id: string
  weapon_pack_id: string
  status: string
  weapon_packs: Pick<
    WeaponPackRow,
    'name' | 'slug' | 'is_mature'
  > | null
}

type TeamBadge = { name: string; shield_key: string }

type MemberRow = {
  lobby_id: string
  user_id: string
  display_name: string
  ready: boolean
  left_at: string | null
  is_test_bot?: boolean
  team: TeamBadge | null
}

export function LobbyScreen() {
  const { lobbyId: routeLobbyId } = useParams()
  const navigate = useNavigate()
  const { supabase, user } = useAuth()
  const { setActiveGameId, activeLobbyId, setActiveLobbyId } = useGameSession()
  const qc = useQueryClient()
  const [inviteInput, setInviteInput] = useState('')
  const [botLabel, setBotLabel] = useState('Bot')
  const [err, setErr] = useState<string | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  /** After case closed, hide embedded game until a new active game (same id + ended = stay on room UI). */
  const [postGameDismissedGameId, setPostGameDismissedGameId] = useState<
    string | null
  >(null)
  const [createPackId, setCreatePackId] = useState<string | null>(null)

  const lobbyId = routeLobbyId ?? null

  useEffect(() => {
    if (routeLobbyId) setActiveLobbyId(routeLobbyId)
  }, [routeLobbyId, setActiveLobbyId])

  useEffect(() => {
    if (routeLobbyId || !user?.id || !activeLobbyId) return
    void navigate(`/app/lobby/${activeLobbyId}`, { replace: true })
  }, [routeLobbyId, user?.id, activeLobbyId, navigate])

  const lobbyQ = useQuery({
    queryKey: ['lobby', lobbyId],
    enabled: !!lobbyId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lobbies' as never)
        .select(
          'id, invite_code, host_id, weapon_pack_id, status, weapon_packs(name, slug, is_mature)',
        )
        .eq('id', lobbyId!)
        .single()
      if (error) throw error
      return data as LobbyRow
    },
  })

  const profileSelfQ = useQuery({
    queryKey: ['my_profile', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles' as never)
        .select('app_role')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as { app_role: string }
    },
  })

  const latestGameQ = useQuery({
    queryKey: ['lobby_latest_game', lobbyId],
    enabled: !!lobbyId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('games' as never)
        .select('id, lobby_id, status, winner_user_id, ended_reason')
        .eq('lobby_id', lobbyId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as LatestGameRow | null
    },
  })

  const latestGame = latestGameQ.data

  useEffect(() => {
    if (!latestGame) return
    if (latestGame.status === 'active') setPostGameDismissedGameId(null)
  }, [latestGame?.id, latestGame?.status])

  const wasInLatestEndedGameQ = useQuery({
    queryKey: [
      'lobby_latest_assignment',
      latestGame?.id,
      user?.id,
      latestGame?.status,
    ],
    enabled:
      !!latestGame?.id &&
      !!user &&
      latestGame.status !== 'active',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignments' as never)
        .select('game_id')
        .eq('game_id', latestGame!.id)
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return Boolean(data)
    },
  })

  const lobbyBlocksGamePanel =
    lobbyQ.data != null && lobbyQ.data.status !== 'open'

  const showGamePanel = Boolean(
    !lobbyBlocksGamePanel &&
      latestGame?.id &&
      (latestGame.status === 'active' ||
        ((latestGame.status === 'ended' ||
          latestGame.status === 'cancelled') &&
          wasInLatestEndedGameQ.data === true &&
          postGameDismissedGameId !== latestGame.id)),
  )

  const handleLeavePostGame = useCallback(() => {
    setErr(null)
    if (lobbyQ.data?.status !== 'open') {
      setPostGameDismissedGameId(null)
      setActiveGameId(null)
      setActiveLobbyId(null)
      void navigate('/app/lobby', { replace: true })
      return
    }
    if (latestGame?.id) setPostGameDismissedGameId(latestGame.id)
    setActiveGameId(null)
    void qc.invalidateQueries({ queryKey: ['lobby_members', lobbyId] })
  }, [
    latestGame?.id,
    lobbyId,
    lobbyQ.data?.status,
    navigate,
    qc,
    setActiveGameId,
    setActiveLobbyId,
  ])

  const handleLeaveRoomFromGame = useCallback(() => {
    setErr(null)
    setPostGameDismissedGameId(null)
    setActiveGameId(null)
    setActiveLobbyId(null)
    void navigate('/app/lobby', { replace: true })
  }, [navigate, setActiveGameId, setActiveLobbyId])

  useEffect(() => {
    if (!lobbyId || !lobbyQ.data || lobbyQ.data.status === 'open') return
    setPostGameDismissedGameId(null)
    setActiveGameId(null)
    setActiveLobbyId(null)
    void navigate('/app/lobby', { replace: true })
  }, [lobbyId, lobbyQ.data?.status, navigate, setActiveGameId, setActiveLobbyId])

  const membersQ = useQuery({
    queryKey: ['lobby_members', lobbyId],
    enabled: !!lobbyId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lobby_members' as never)
        .select('lobby_id, user_id, display_name, ready, left_at')
        .eq('lobby_id', lobbyId!)
        .is('left_at', null)
        .order('joined_at', { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as Omit<MemberRow, 'is_test_bot' | 'team'>[]
      if (rows.length === 0) return [] as MemberRow[]
      const ids = rows.map((r) => r.user_id)
      const { data: profs, error: pe } = await supabase
        .from('profiles' as never)
        .select('id, is_test_bot')
        .in('id', ids)
      if (pe) throw pe
      const botMap = new Map(
        (profs ?? []).map((p: { id: string; is_test_bot: boolean }) => [
          p.id,
          p.is_test_bot,
        ]),
      )
      const { data: teamRows, error: teamErr } = await supabase
        .from('team_members' as never)
        .select('user_id, teams(name, shield_key)')
        .in('user_id', ids)
      if (teamErr) throw teamErr
      const teamMap = new Map<string, TeamBadge>()
      for (const raw of teamRows ?? []) {
        const row = raw as {
          user_id: string
          teams: TeamBadge | TeamBadge[] | null
        }
        const t = row.teams
        const pack = Array.isArray(t) ? t[0] : t
        if (pack?.name && pack?.shield_key)
          teamMap.set(row.user_id, {
            name: pack.name,
            shield_key: pack.shield_key,
          })
      }
      return rows.map((r) => ({
        ...r,
        is_test_bot: botMap.get(r.user_id) ?? false,
        team: teamMap.get(r.user_id) ?? null,
      })) as MemberRow[]
    },
  })

  useEffect(() => {
    if (!lobbyId || !user) return
    const ch = supabase
      .channel(`lobby:${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobby_members',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['lobby_members', lobbyId] })
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lobbies',
          filter: `id=eq.${lobbyId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['lobby', lobbyId] })
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `lobby_id=eq.${lobbyId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['lobby_latest_game', lobbyId] })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [lobbyId, qc, supabase, user])

  useEffect(() => {
    if (!lobbyId || !user) return
    if (!lobbyQ.isError) return
    setActiveLobbyId(null)
    void navigate('/app/lobby', { replace: true })
  }, [lobbyId, user, lobbyQ.isError, navigate, setActiveLobbyId])

  const packsQ = useQuery({
    queryKey: ['weapon_packs_lobby'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weapon_packs' as never)
        .select('id, slug, name, description, is_mature, sort_order')
        .eq('is_premium', false)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as WeaponPackRow[]
    },
  })

  useEffect(() => {
    if (createPackId !== null) return
    const def = packsQ.data?.find((p) => p.slug === 'default')
    if (def) setCreatePackId(def.id)
  }, [packsQ.data, createPackId])

  const createMut = useMutation({
    mutationFn: async () => {
      const packId = createPackId ?? packsQ.data?.find((p) => p.slug === 'default')?.id
      const { data, error } = await supabase.rpc('create_lobby' as never, {
        p_weapon_pack_id: packId ?? null,
      } as never)
      if (error) throw error
      return data as LobbyRow
    },
    onSuccess: (data) => {
      const row = Array.isArray(data) ? (data[0] as LobbyRow) : (data as LobbyRow)
      void navigate(`/app/lobby/${row.id}`, { replace: true })
    },
    onError: (e: Error) => setErr(e.message),
  })

  const joinMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc(
        'join_lobby_by_invite' as never,
        {
          p_invite_code: inviteInput.trim(),
        } as never,
      )
      if (error) throw error
      return data as string
    },
    onSuccess: (id) => {
      void navigate(`/app/lobby/${id}`, { replace: true })
    },
    onError: (e: Error) => setErr(e.message),
  })

  const readyMut = useMutation({
    mutationFn: async (ready: boolean) => {
      const { error } = await supabase
        .from('lobby_members' as never)
        .update({ ready } as never)
        .eq('lobby_id', lobbyId!)
        .eq('user_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lobby_members', lobbyId] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  const startMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('start_game' as never, {
        p_lobby_id: lobbyId,
      } as never)
      if (error) throw error
      return data as string
    },
    onSuccess: (gameId) => {
      setActiveGameId(gameId)
      void qc.invalidateQueries({ queryKey: ['lobby_latest_game', lobbyId] })
      void qc.invalidateQueries({ queryKey: ['lobby_latest_assignment'] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  const closeMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('close_lobby' as never, {
        p_lobby_id: lobbyId,
      } as never)
      if (error) throw error
    },
    onSuccess: () => {
      setActiveGameId(null)
      setActiveLobbyId(null)
      void navigate('/app/lobby', { replace: true })
    },
    onError: (e: Error) => setErr(e.message),
  })

  const setPackMut = useMutation({
    mutationFn: async (packId: string) => {
      const { error } = await supabase.rpc('host_set_lobby_weapon_pack' as never, {
        p_lobby_id: lobbyId,
        p_weapon_pack_id: packId,
      } as never)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lobby', lobbyId] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  const resetLobbyAfterGameMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('host_reset_lobby_ready' as never, {
        p_lobby_id: lobbyId,
      } as never)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lobby_members', lobbyId] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  const addBotMut = useMutation({
    mutationFn: async () => {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/admin/lobby-bot', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lobbyId,
          displayName: botLabel.trim() || undefined,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        throw new Error(body.message ?? res.statusText)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lobby_members', lobbyId] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  const removeBotMut = useMutation({
    mutationFn: async (botUserId: string) => {
      const { error } = await supabase.rpc('admin_remove_lobby_bot' as never, {
        p_lobby_id: lobbyId,
        p_bot_user_id: botUserId,
      } as never)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lobby_members', lobbyId] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  const myMember = useMemo(
    () => membersQ.data?.find((m) => m.user_id === user?.id),
    [membersQ.data, user?.id],
  )

  const readyCount = useMemo(
    () => membersQ.data?.filter((m) => m.ready).length ?? 0,
    [membersQ.data],
  )
  const total = membersQ.data?.length ?? 0

  /** Matches server start_game: ready members plus host even if host did not click Ready */
  const inMatchCount = useMemo(() => {
    const hostId = lobbyQ.data?.host_id
    if (!membersQ.data || !hostId) return 0
    const ids = new Set<string>()
    for (const m of membersQ.data) {
      if (m.left_at) continue
      if (m.ready || m.user_id === hostId) ids.add(m.user_id)
    }
    return ids.size
  }, [membersQ.data, lobbyQ.data?.host_id])

  const isHost = lobbyQ.data?.host_id === user?.id
  const isAdminHost =
    isHost && profileSelfQ.data?.app_role === 'admin'

  const lobbyPackMeta = useMemo(() => {
    const wp = lobbyQ.data?.weapon_packs
    if (!wp) return null
    return Array.isArray(wp) ? wp[0] : wp
  }, [lobbyQ.data?.weapon_packs])

  if (!lobbyId) {
    if (activeLobbyId) {
      return (
        <div className="screen lobby-screen">
          <p className="muted">Opening your room…</p>
        </div>
      )
    }
    return (
      <>
        <div className="screen lobby-screen">
          <header className="lobby-screen__head glass-surface">
            <h1>Room</h1>
            <button
              type="button"
              className="auth-rules-btn"
              aria-label="Open field manual"
              onClick={() => setRulesOpen(true)}
            >
              ?
            </button>
          </header>
          <div className="lobby-screen__sheet glass-surface">
            <p className="muted">Create a room or join with a code.</p>
            {err ? <p className="error">{err}</p> : null}
            <label className="field lobby-pack-field">
              <span>Weapon pack (scene)</span>
              <select
                className="lobby-pack-select"
                value={createPackId ?? ''}
                onChange={(e) => {
                  const id = e.target.value
                  const pack = packsQ.data?.find((p) => p.id === id)
                  if (pack?.is_mature) {
                    const ok = window.confirm(
                      'This pack uses explicit adult humor and language. Only choose it if everyone in the room agrees. Continue?',
                    )
                    if (!ok) {
                      e.target.value = createPackId ?? ''
                      return
                    }
                  }
                  setCreatePackId(id || null)
                }}
                disabled={!packsQ.data?.length}
              >
                {!packsQ.data?.length ? (
                  <option value="">Loading packs…</option>
                ) : (
                  packsQ.data.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.is_mature ? ' (18+)' : ''}
                    </option>
                  ))
                )}
              </select>
              {packsQ.data?.find((p) => p.id === createPackId)?.description ? (
                <span className="muted small lobby-pack-hint">
                  {packsQ.data.find((p) => p.id === createPackId)?.description}
                </span>
              ) : null}
            </label>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setErr(null)
                createMut.mutate()
              }}
              disabled={createMut.isPending || !createPackId}
            >
              {createMut.isPending ? 'Creating…' : 'Create lobby'}
            </button>
            <label className="field">
              <span>Invite code</span>
              <input
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
                placeholder="ABC123"
                autoCapitalize="characters"
              />
            </label>
            <p className="muted small">
              You appear as your <strong>codename</strong> from Profile — set it there before
              joining.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setErr(null)
                joinMut.mutate()
              }}
              disabled={joinMut.isPending || !inviteInput.trim()}
            >
              {joinMut.isPending ? 'Joining…' : 'Join lobby'}
            </button>
          </div>
        </div>
        <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </>
    )
  }

  if (
    lobbyQ.isLoading ||
    membersQ.isLoading ||
    latestGameQ.isLoading ||
    (latestGame &&
      latestGame.status !== 'active' &&
      wasInLatestEndedGameQ.isLoading)
  ) {
    return (
      <div className="screen">
        <p className="muted">Loading room…</p>
      </div>
    )
  }

  if (lobbyQ.isError || !lobbyQ.data) {
    return (
      <div className="screen">
        <p className="error">Room not found or you are not a member.</p>
        <Link to="/app/lobby" className="btn">
          Back
        </Link>
      </div>
    )
  }

  if (lobbyQ.data.status !== 'open') {
    return (
      <>
        <div className="screen lobby-screen">
          <p className="muted">This room has ended.</p>
          <Link to="/app/lobby" className="btn btn--primary">
            Create or join a lobby
          </Link>
          <button
            type="button"
            className="linkish"
            onClick={() => setRulesOpen(true)}
          >
            Field manual
          </button>
        </div>
        <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </>
    )
  }

  if (showGamePanel && latestGame?.id) {
    return (
      <>
        <GamePanel
          key={latestGame.id}
          gameId={latestGame.id}
          embedded
          onLeavePostGame={handleLeavePostGame}
          onResetLobby={
            isHost && lobbyId
              ? () => resetLobbyAfterGameMut.mutateAsync()
              : undefined
          }
          resetLobbyBusy={resetLobbyAfterGameMut.isPending}
          onLeaveRoom={handleLeaveRoomFromGame}
          onOpenFieldManual={() => setRulesOpen(true)}
        />
        <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </>
    )
  }

  return (
    <>
      <div className="screen lobby-screen">
        <header className="lobby-screen__head glass-surface">
          <h1>Room</h1>
          <button
            type="button"
            className="auth-rules-btn"
            aria-label="Open field manual"
            onClick={() => setRulesOpen(true)}
          >
            ?
          </button>
        </header>
      {err ? <p className="error">{err}</p> : null}
      <section className="card">
        <p className="muted">Invite code</p>
        <p className="mono big-code">{lobbyQ.data.invite_code}</p>
        <p className="muted small">
          Share this code so friends can join from the Room tab.
        </p>
      </section>

      <section className="card">
        <h2>Players ({total})</h2>
        <ul className="member-list">
          {membersQ.data?.map((m) => (
            <li key={m.user_id}>
              <div className="lobby-member-line">
                {m.team && isTeamShieldKey(m.team.shield_key) ? (
                  <TeamShieldBadge
                    shieldKey={m.team.shield_key}
                    title={m.team.name}
                    size={26}
                  />
                ) : null}
                <span className="lobby-member-name">{m.display_name}</span>
              </div>
              {m.is_test_bot ? (
                <span className="pill pill--ready">bot</span>
              ) : null}
              {m.user_id === lobbyQ.data.host_id ? (
                <span className="pill pill--host">host</span>
              ) : null}
              {m.ready ? (
                <span className="pill pill--ready">ready</span>
              ) : (
                <span className="pill">waiting</span>
              )}
            </li>
          ))}
        </ul>
        <p className="muted small">
          Ready: {readyCount} / {total}. In the match when you start: {inMatchCount}{' '}
          (includes host even without Ready — need at least 2).
        </p>
      </section>

      {isHost ? (
        <section className="card">
          <h2>Weapon pack</h2>
          <p className="muted small">
            Current:{' '}
            <strong>{lobbyPackMeta?.name ?? 'Standard'}</strong>
            {lobbyPackMeta?.is_mature ? (
              <span className="pill pill--ready" style={{ marginLeft: '0.35rem' }}>
                18+
              </span>
            ) : null}
          </p>
          <label className="field lobby-pack-field">
            <span>Change pack (before starting)</span>
            <select
              className="lobby-pack-select"
              value={lobbyQ.data.weapon_pack_id}
              disabled={
                setPackMut.isPending ||
                packsQ.isLoading ||
                latestGame?.status === 'active'
              }
              onChange={(e) => {
                const id = e.target.value
                if (id === lobbyQ.data.weapon_pack_id) return
                const pack = packsQ.data?.find((p) => p.id === id)
                if (pack?.is_mature) {
                  const ok = window.confirm(
                    'This pack uses explicit adult humor. Confirm everyone in the room is okay with it.',
                  )
                  if (!ok) return
                }
                setErr(null)
                setPackMut.mutate(id)
              }}
            >
              {(packsQ.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.is_mature ? ' (18+)' : ''}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : (
        <section className="card">
          <h2>Weapon pack</h2>
          <p className="muted small">
            This round uses:{' '}
            <strong>{lobbyPackMeta?.name ?? '—'}</strong>
            {lobbyPackMeta?.is_mature ? (
              <span className="pill pill--ready" style={{ marginLeft: '0.35rem' }}>
                18+
              </span>
            ) : null}
          </p>
        </section>
      )}

      {isAdminHost ? (
        <section className="card">
          <h2>Test bots (admin)</h2>
          <p className="muted small">
            {
              "Creates a real Auth user flagged as a bot, joins ready. In Supabase SQL editor, set profiles.app_role to 'admin' for your auth user id once."
            }
          </p>
          <label className="field">
            <span>Bot display name</span>
            <input
              value={botLabel}
              onChange={(e) => setBotLabel(e.target.value)}
              placeholder="Bot"
            />
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setErr(null)
              addBotMut.mutate()
            }}
            disabled={addBotMut.isPending}
          >
            {addBotMut.isPending ? 'Adding…' : 'Add bot to lobby'}
          </button>
          <ul className="member-list">
            {membersQ.data
              ?.filter((m) => m.is_test_bot)
              .map((m) => (
                <li key={m.user_id} className="mono small">
                  {m.display_name}{' '}
                  <button
                    type="button"
                    className="linkish danger"
                    onClick={() => {
                      setErr(null)
                      removeBotMut.mutate(m.user_id)
                    }}
                    disabled={removeBotMut.isPending}
                  >
                    Remove
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <div className="btn-row">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setErr(null)
            readyMut.mutate(!myMember?.ready)
          }}
          disabled={readyMut.isPending}
        >
          {myMember?.ready ? 'Un-ready' : 'Ready'}
        </button>
        {isHost ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setErr(null)
              startMut.mutate()
            }}
            disabled={startMut.isPending || inMatchCount < 2 || total < 2}
          >
            {startMut.isPending ? 'Starting…' : 'Start game'}
          </button>
        ) : null}
      </div>

      {isHost ? (
        <button
          type="button"
          className="linkish danger"
          onClick={() => {
            setErr(null)
            if (confirm('Close this lobby for everyone?')) closeMut.mutate()
          }}
        >
          End lobby
        </button>
      ) : null}

      <Link
        to="/app/lobby"
        className="linkish"
        onClick={(e) => {
          e.preventDefault()
          setActiveLobbyId(null)
          void navigate('/app/lobby', { replace: true })
        }}
      >
        Leave room
      </Link>
      </div>
      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  )
}
