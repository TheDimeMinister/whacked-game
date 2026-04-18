/* eslint-disable react-refresh/only-export-components -- hook colocated with provider */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY_GAME = 'whacked_active_game_id'
const STORAGE_KEY_LOBBY = 'whacked_active_lobby_id'

type Ctx = {
  activeGameId: string | null
  setActiveGameId: (id: string | null) => void
  activeLobbyId: string | null
  setActiveLobbyId: (id: string | null) => void
}

const Ctx = createContext<Ctx | null>(null)

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const [activeGameId, setGameState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_GAME)
    } catch {
      return null
    }
  })

  const [activeLobbyId, setLobbyState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_LOBBY)
    } catch {
      return null
    }
  })

  const setActiveGameId = useCallback((id: string | null) => {
    setGameState(id)
    try {
      if (id) localStorage.setItem(STORAGE_KEY_GAME, id)
      else localStorage.removeItem(STORAGE_KEY_GAME)
    } catch {
      /* ignore */
    }
  }, [])

  const setActiveLobbyId = useCallback((id: string | null) => {
    setLobbyState(id)
    try {
      if (id) localStorage.setItem(STORAGE_KEY_LOBBY, id)
      else localStorage.removeItem(STORAGE_KEY_LOBBY)
    } catch {
      /* ignore */
    }
  }, [])

  const value = useMemo(
    () => ({
      activeGameId,
      setActiveGameId,
      activeLobbyId,
      setActiveLobbyId,
    }),
    [activeGameId, setActiveGameId, activeLobbyId, setActiveLobbyId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGameSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useGameSession outside GameSessionProvider')
  return v
}
