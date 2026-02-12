export type UserRole = 'STUDENT' | 'ADMIN'

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
  department?: string
}
