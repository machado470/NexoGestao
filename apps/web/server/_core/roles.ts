export type SystemRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'

export function normalizeRole(role: unknown): string | null {
  if (typeof role !== 'string') return null
  const normalized = role.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

export function isAdminRole(role: unknown): boolean {
  return normalizeRole(role) === 'ADMIN'
}
