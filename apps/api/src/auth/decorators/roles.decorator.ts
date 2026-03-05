import { SetMetadata } from '@nestjs/common'

export type AppRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'

export const ROLES_KEY = 'roles'
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles)
