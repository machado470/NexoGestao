import { createContext } from 'react'

export interface AuthContextType {
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType,
)
