import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function RequireAuth({
  children,
}: {
  children: ReactNode
}) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
