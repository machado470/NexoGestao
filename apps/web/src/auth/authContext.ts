import { createContext } from 'react'

export type UserRole = 'ADMIN' | 'COLLABORATOR'

export type AuthUser = {
  id: string
  role: UserRole
  orgId: string
  personId: string | null
}

export interface AuthContextType {
  isAuthenticated: boolean
  loading: boolean
  user: AuthUser | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType,
)
