import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import { useGameSession } from '../providers/GameSessionProvider'

/** Old `/app/game/:id` links: send users to the combined room route. */
export function GameRedirect() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const { supabase, user } = useAuth()
  const { setActiveGameId } = useGameSession()

  useEffect(() => {
    if (!gameId || !user) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('games')
        .select('lobby_id')
        .eq('id', gameId)
        .maybeSingle()
      if (cancelled) return
      if (error || !data?.lobby_id) {
        void navigate('/app/lobby', { replace: true })
        return
      }
      setActiveGameId(gameId)
      void navigate(`/app/lobby/${data.lobby_id}`, { replace: true })
    })()
    return () => {
      cancelled = true
    }
  }, [gameId, user, supabase, navigate, setActiveGameId])

  return (
    <div className="screen">
      <p className="muted">Opening room…</p>
    </div>
  )
}
