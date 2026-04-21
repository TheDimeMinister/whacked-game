import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAuth } from './providers/AuthProvider'
import { useGameSession } from './providers/GameSessionProvider'
import { AuthScreen } from './routes/AuthScreen'
import { ForgotPasswordScreen } from './routes/ForgotPasswordScreen'
import { ResetPasswordScreen } from './routes/ResetPasswordScreen'
import { WelcomeScreen } from './routes/WelcomeScreen'
import { GameRedirect } from './routes/GameRedirect'
import { LeaderboardScreen } from './routes/LeaderboardScreen'
import { LobbyScreen } from './routes/LobbyScreen'
import { ProfileScreen } from './routes/ProfileScreen'
import { RequireAuth } from './routes/RequireAuth'
import { StoreScreen } from './routes/StoreScreen'

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="brand-stage shell-loading">
        <p className="muted">Loading…</p>
      </div>
    )
  }
  if (user) return <Navigate to="/app/lobby" replace />
  return <Navigate to="/welcome" replace />
}

function AppHome() {
  const { activeLobbyId } = useGameSession()
  if (activeLobbyId) {
    return <Navigate to={`/app/lobby/${activeLobbyId}`} replace />
  }
  return <Navigate to="/app/lobby" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/welcome" element={<WelcomeScreen />} />
      <Route path="/auth" element={<AuthScreen />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordScreen />} />
      <Route path="/auth/reset-password" element={<ResetPasswordScreen />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<AppHome />} />
        <Route path="lobby" element={<LobbyScreen />} />
        <Route path="lobby/:lobbyId" element={<LobbyScreen />} />
        <Route path="game" element={<Navigate to="/app/lobby" replace />} />
        <Route path="game/:gameId" element={<GameRedirect />} />
        <Route path="leaderboard" element={<LeaderboardScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="store" element={<StoreScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
