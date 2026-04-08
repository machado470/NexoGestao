import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator'

const ROLE_NORMALIZATION: Record<string, 'ADMIN' | 'OPERADOR' | 'FINANCEIRO'> = {
  ADMIN: 'ADMIN',
  MANAGER: 'OPERADOR',
  STAFF: 'OPERADOR',
  OPERADOR: 'OPERADOR',
  VIEWER: 'FINANCEIRO',
  FINANCEIRO: 'FINANCEIRO',
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? []

    // Se rota não exige role, passa
    if (requiredRoles.length === 0) return true

    const req = context.switchToHttp().getRequest()
    const user = req?.user

    if (!user?.role) {
      throw new ForbiddenException('Sem permissão (role ausente).')
    }

    const userRole = ROLE_NORMALIZATION[user.role] ?? user.role
    const acceptedRoles = new Set(
      requiredRoles.map((role) => ROLE_NORMALIZATION[role] ?? role),
    )

    if (userRole === 'ADMIN') return true

    if (!acceptedRoles.has(userRole)) {
      throw new ForbiddenException('Sem permissão (role).')
    }

    return true
  }
}
