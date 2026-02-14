import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export default function RequireAdmin() {
  const { isAuthenticated, loading, user } = useAuth()

  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/collaborator" replace />
  }

  return <Outlet />
}
