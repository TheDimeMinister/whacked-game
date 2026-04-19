import { Navigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'
import type { ReactNode } from 'react'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="brand-stage shell-loading">
        <p className="muted">Loading…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}
