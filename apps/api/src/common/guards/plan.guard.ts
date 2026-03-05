import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { QuotasService, QuotaLimits } from '../../quotas/quotas.service'

export const PLAN_QUOTA_KEY = 'plan_quota'

export type QuotaActionKey =
  | 'CREATE_CUSTOMER'
  | 'CREATE_APPOINTMENT'
  | 'CREATE_SERVICE_ORDER'
  | 'ADD_COLLABORATOR'

/**
 * Decorator para marcar um endpoint com a ação de quota que deve ser verificada.
 * Uso: @RequireQuota('CREATE_CUSTOMER')
 */
export const RequireQuota = (action: QuotaActionKey) =>
  SetMetadata(PLAN_QUOTA_KEY, action)

/**
 * Guard que verifica se a organização tem quota disponível para a ação.
 * Deve ser usado em conjunto com @RequireQuota().
 */
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly quotasService: QuotasService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<QuotaActionKey>(PLAN_QUOTA_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // Se não há ação de quota definida, permite passar
    if (!action) return true

    const request = context.switchToHttp().getRequest()
    const orgId = request.user?.orgId

    if (!orgId) {
      throw new ForbiddenException('Organização não identificada na requisição')
    }

    // Delega a validação para o QuotasService
    await this.quotasService.validateQuota(orgId, action)

    return true
  }
}
