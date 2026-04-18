import { NavLink } from 'react-router-dom'
import { useGameSession } from '../providers/GameSessionProvider'

export function BottomNav() {
  const { activeGameId, activeLobbyId } = useGameSession()
  const gameTo = activeGameId ? `/app/game/${activeGameId}` : '/app/game'
  const lobbyTo = activeLobbyId ? `/app/lobby/${activeLobbyId}` : '/app/lobby'

  return (
    <nav className="bottom-nav" aria-label="Main">
      <NavLink
        to={gameTo}
        className={({ isActive }) =>
          `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
        }
      >
        Game
      </NavLink>
      <NavLink
        to={lobbyTo}
        className={({ isActive }) =>
          `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
        }
      >
        Lobby
      </NavLink>
      <NavLink
        to="/app/profile"
        className={({ isActive }) =>
          `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
        }
      >
        Profile
      </NavLink>
      <NavLink
        to="/app/store"
        className={({ isActive }) =>
          `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
        }
      >
        Store
      </NavLink>
    </nav>
  )
}
