export type Role = 'admin' | 'manager' | 'staff' | 'viewer'

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
  admin: [
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
  manager: [
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
  staff: [
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
  viewer: [
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
    admin: 'Administrador',
    manager: 'Gerente',
    staff: 'Equipe',
    viewer: 'Visualizador',
  }

  return labels[role]
}

export function getRoleColor(role: Role): string {
  const colors: Record<Role, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    staff: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  }

  return colors[role]
}
