import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMe } from '../hooks/useMe'

export function RequireAdmin({
  children,
}: {
  children: ReactNode
}) {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { me, loading: meLoading } = useMe()

  if (authLoading || meLoading) return null

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (me?.role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
