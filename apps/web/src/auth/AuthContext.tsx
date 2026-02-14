import { useEffect, useState } from 'react'
import api from '../services/api'
import { AuthContext } from './authContext'
import type { AuthUser } from './authContext'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)

  async function hydrateFromMe() {
    try {
      const res = await api.get('/me')
      const u = res.data?.user

      if (!u?.id || !u?.role || !u?.orgId) throw new Error('invalid-me')

      setUser({
        id: u.id,
        role: u.role,
        orgId: u.orgId,
        personId: u.personId ?? null,
      })

      setIsAuthenticated(true)
    } catch {
      localStorage.removeItem('access_token')
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setIsAuthenticated(false)
      setUser(null)
      setLoading(false)
      return
    }

    hydrateFromMe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function login(email: string, password: string) {
    try {
      const res = await api.post('/auth/login', { email, password })
      const token = res.data?.token
      if (!token) throw new Error('token-missing')

      localStorage.setItem('access_token', token)

      setLoading(true)
      await hydrateFromMe()

      return true
    } catch {
      setLoading(false)
      return false
    }
  }

  function logout() {
    localStorage.removeItem('access_token')
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        loading,
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
