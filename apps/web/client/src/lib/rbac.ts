export type Role = 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'

export type Permission =
  | 'customers:create'
  | 'customers:read'
  | 'customers:update'
  | 'customers:delete'
  | 'appointments:create'
  | 'appointments:read'
  | 'appointments:update'
  | 'appointments:delete'
  | 'orders:create'
  | 'orders:read'
  | 'orders:update'
  | 'orders:delete'
  | 'finance:read'
  | 'finance:update'
  | 'finance:delete'
  | 'people:manage'
  | 'governance:read'
  | 'governance:update'
  | 'reports:read'
  | 'reports:export'
  | 'settings:manage'

const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [
    'customers:create',
    'customers:read',
    'customers:update',
    'customers:delete',
    'appointments:create',
    'appointments:read',
    'appointments:update',
    'appointments:delete',
    'orders:create',
    'orders:read',
    'orders:update',
    'orders:delete',
    'finance:read',
    'finance:update',
    'finance:delete',
    'people:manage',
    'governance:read',
    'governance:update',
    'reports:read',
    'reports:export',
    'settings:manage',
  ],
  MANAGER: [
    'customers:create',
    'customers:read',
    'customers:update',
    'customers:delete',
    'appointments:create',
    'appointments:read',
    'appointments:update',
    'appointments:delete',
    'orders:create',
    'orders:read',
    'orders:update',
    'orders:delete',
    'finance:read',
    'finance:update',
    'governance:read',
    'reports:read',
    'reports:export',
  ],
  STAFF: [
    'customers:read',
    'customers:create',
    'customers:update',
    'appointments:read',
    'appointments:create',
    'appointments:update',
    'orders:read',
    'orders:create',
    'orders:update',
    'finance:read',
    'reports:read',
  ],
  VIEWER: [
    'customers:read',
    'appointments:read',
    'orders:read',
    'finance:read',
    'governance:read',
    'reports:read',
  ],
}

export function can(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

export function canAny(role: Role, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(role, permission))
}

export function canAll(role: Role, permissions: Permission[]): boolean {
  return permissions.every((permission) => can(role, permission))
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    ADMIN: 'Administrador',
    MANAGER: 'Gerente',
    STAFF: 'Equipe',
    VIEWER: 'Visualizador',
  }

  return labels[role]
}

export function getRoleColor(role: Role): string {
  const colors: Record<Role, string> = {
    ADMIN: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    MANAGER: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200',
    STAFF: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    VIEWER: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  }

  return colors[role]
}

export function normalizeRole(role: unknown): Role | null {
  const value = String(role ?? '').trim().toUpperCase()

  if (
    value === 'ADMIN' ||
    value === 'MANAGER' ||
    value === 'STAFF' ||
    value === 'VIEWER'
  ) {
    return value
  }

  return null
}
