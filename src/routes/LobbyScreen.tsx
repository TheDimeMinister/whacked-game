import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RulesModal } from '../components/RulesModal'
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

type LobbyRow = {
  id: string
  invite_code: string
  host_id: string
  weapon_pack_id: string
  status: string
}

type MemberRow = {
  lobby_id: string
  user_id: string
  display_name: string
  ready: boolean
  left_at: string | null
  is_test_bot?: boolean
}

export function LobbyScreen() {
  const { lobbyId: routeLobbyId } = useParams()
  const navigate = useNavigate()
  const { supabase, user } = useAuth()
  const { setActiveGameId, activeLobbyId, setActiveLobbyId } = useGameSession()
  const qc = useQueryClient()
  const [inviteInput, setInviteInput] = useState('')
  const [joinName, setJoinName] = useState('')
  const [botLabel, setBotLabel] = useState('Bot')
  const [err, setErr] = useState<string | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)
  /** After case closed, hide embedded game until a new active game (same id + ended = stay on room UI). */
  const [postGameDismissedGameId, setPostGameDismissedGameId] = useState<
    string | null
  >(null)

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
        .select('id, invite_code, host_id, weapon_pack_id, status')
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
      const rows = (data ?? []) as Omit<MemberRow, 'is_test_bot'>[]
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
      return rows.map((r) => ({
        ...r,
        is_test_bot: botMap.get(r.user_id) ?? false,
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

  const createMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('create_lobby' as never, {
        p_weapon_pack_id: null,
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
          p_display_name: joinName.trim() || null,
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
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setErr(null)
                createMut.mutate()
              }}
              disabled={createMut.isPending}
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
            <label className="field">
              <span>Display name (optional)</span>
              <input
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="How you appear in the lobby"
              />
            </label>
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
              <span>{m.display_name}</span>
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
          (includes host even without Ready — need 4+).
        </p>
      </section>

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
            disabled={startMut.isPending || inMatchCount < 4 || total < 4}
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
