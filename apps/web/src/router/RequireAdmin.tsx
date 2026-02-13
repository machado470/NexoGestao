import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export default function RequireAdmin() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Se depois você tiver role/admin no token, valida aqui.
  return <Outlet />
}
