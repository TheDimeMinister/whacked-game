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
  const { supabase, user, signOut } = useAuth()
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
      <button
        type="button"
        className="app-logout-btn"
        aria-label="Log out"
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
        <span>Logout</span>
      </button>
      <main className="app-main">
        <div className="app-main__inner">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
