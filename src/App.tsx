import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAuth } from './providers/AuthProvider'
import { AuthScreen } from './routes/AuthScreen'
import { GameScreen } from './routes/GameScreen'
import { LobbyScreen } from './routes/LobbyScreen'
import { ProfileScreen } from './routes/ProfileScreen'
import { RequireAuth } from './routes/RequireAuth'
import { StoreScreen } from './routes/StoreScreen'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="auth-screen">
        <p className="muted">Loading…</p>
      </div>
    )
  }
  if (user) return <Navigate to="/app/lobby" replace />
  return <Navigate to="/auth" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/auth" element={<AuthScreen />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/app/lobby" replace />} />
        <Route path="lobby" element={<LobbyScreen />} />
        <Route path="lobby/:lobbyId" element={<LobbyScreen />} />
        <Route path="game" element={<GameScreen />} />
        <Route path="game/:gameId" element={<GameScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="store" element={<StoreScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
