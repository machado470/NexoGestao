import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator'

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

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Sem permissão (role).')
    }

    return true
  }
}
