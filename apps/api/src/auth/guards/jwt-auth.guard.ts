import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'
import { firstValueFrom, isObservable } from 'rxjs'
import { ROLES_KEY, AppRole } from '../decorators/roles.decorator'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    )

    if (isPublic) {
      return true
    }

    const result = super.canActivate(context)
    const authenticated = isObservable(result) ? await firstValueFrom(result) : await result
    const user = context.switchToHttp().getRequest().user
    const roles = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (user?.role === 'CONTRACTOR' && !roles?.includes('CONTRACTOR')) {
      throw new ForbiddenException('Sem permissão (role).')
    }
    return authenticated
  }
}
