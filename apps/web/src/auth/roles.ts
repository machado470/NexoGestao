export type UserRole = 'ADMIN' | 'COLLABORATOR'

export const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Admin',
  COLLABORATOR: 'Colaborador',
}
