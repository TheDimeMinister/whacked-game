import { NavLink } from 'react-router-dom'
import { useGameSession } from '../providers/GameSessionProvider'

export function BottomNav() {
  const { activeLobbyId } = useGameSession()
  const roomTo = activeLobbyId ? `/app/lobby/${activeLobbyId}` : '/app/lobby'

  return (
    <nav className="bottom-nav" aria-label="Main">
      <NavLink
        to={roomTo}
        className={({ isActive }) =>
          `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
        }
      >
        Room
      </NavLink>
      <NavLink
        to="/app/leaderboard"
        className={({ isActive }) =>
          `bottom-nav__link ${isActive ? 'bottom-nav__link--active' : ''}`
        }
      >
        Board
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
