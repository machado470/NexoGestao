import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'

interface AuthContextType {
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType,
)

export function AuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAuthenticated, setIsAuthenticated] =
    useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    setIsAuthenticated(!!token)
    setLoading(false)
  }, [])

  async function login(email: string, password: string) {
    try {
      const res = await api.post('/auth/login', {
        email,
        password,
      })

      localStorage.setItem(
        'access_token',
        res.data.token,
      )

      setIsAuthenticated(true)
      return true
    } catch {
      return false
    }
  }

  function logout() {
    localStorage.removeItem('access_token')
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

