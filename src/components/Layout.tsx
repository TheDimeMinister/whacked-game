import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import { useGameSession } from '../providers/GameSessionProvider'
import { BottomNav } from './BottomNav'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname
  const { supabase, user } = useAuth()
  const { activeLobbyId, setActiveGameId } = useGameSession()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user?.id || !activeLobbyId) return

    const ch = supabase
      .channel(`lobby-active-game:${activeLobbyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'games',
          filter: `lobby_id=eq.${activeLobbyId}`,
        },
        (payload) => {
          const row = payload.new as { id?: string; status?: string }
          if (!row?.id || row.status !== 'active') return
          setActiveGameId(row.id)
          void qc.invalidateQueries({
            queryKey: ['lobby_latest_game', activeLobbyId],
          })
          const path = `/app/lobby/${activeLobbyId}`
          if (pathRef.current !== path) {
            void navigate(path, { replace: true })
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [user?.id, activeLobbyId, supabase, navigate, setActiveGameId, qc])

  return (
    <div className="app-shell brand-stage">
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
