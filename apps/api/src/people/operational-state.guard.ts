import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Inject,
  RequestMethod,
} from '@nestjs/common'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { OperationalStateService } from './operational-state.service'
import { TimelineService } from '../timeline/timeline.service'

/**
 * Regularization routes a RESTRICTED person may still POST to, identified by the controller and
 * handler route declared in code (`controller path/handler path`, without global prefix).
 *
 * C8 PR3-3B-1: the previous check used `originalUrl.includes('/corrective-actions' | '/reassess')`.
 * `originalUrl` includes the query string, so any POST protected by this guard passed with
 * `?x=/reassess`. Matching the declared route makes the decision independent of the request URL
 * (query string, global prefix, parameter values, encoding). Same two routes as before.
 */
export const RESTRICTED_REGULARIZATION_ROUTES: ReadonlySet<string> = new Set([
  'corrective-actions/:id/resolve',
  'corrective-actions/person/:personId/reassess',
])

const trimSlashes = (value: unknown) => (typeof value === 'string' ? value.replace(/^\/+|\/+$/g, '') : '')

/** Route declared for the handler being executed, e.g. `corrective-actions/:id/resolve`. */
function declaredRoute(context: ExecutionContext): { method: RequestMethod | undefined; path: string } {
  const handler = context.getHandler?.()
  const controller = context.getClass?.()
  const controllerPath = controller ? Reflect.getMetadata(PATH_METADATA, controller) : undefined
  const handlerPath = handler ? Reflect.getMetadata(PATH_METADATA, handler) : undefined
  // Only single string paths are used by the regularization routes; anything else never matches.
  if (typeof controllerPath !== 'string' || typeof handlerPath !== 'string') {
    return { method: undefined, path: '' }
  }
  return {
    method: handler ? Reflect.getMetadata(METHOD_METADATA, handler) : undefined,
    path: [trimSlashes(controllerPath), trimSlashes(handlerPath)].filter(Boolean).join('/'),
  }
}

@Injectable()
export class OperationalStateGuard implements CanActivate {
  constructor(
    @Inject(OperationalStateService)
    private readonly operationalState: OperationalStateService,

    @Inject(TimelineService)
    private readonly timeline: TimelineService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const user = req.user

    // ✅ Admin nunca é bloqueado (operação precisa funcionar)
    if (user?.role === 'ADMIN') {
      return true
    }

    // Usuário sem pessoa vinculada (ex: token técnico / futuro)
    if (!user || !user.personId) {
      return true
    }

    const status = await this.operationalState.getStatus(user.personId)

    const method = req.method
    const url: string = req.originalUrl ?? req.url ?? ''

    // 🚫 SUSPENDED: nada passa
    if (status.state === 'SUSPENDED') {
      await this.timeline.log({
        orgId: user.orgId,
        action: 'OPERATIONAL_ACCESS_BLOCKED',
        personId: user.personId,
        description: 'Acesso bloqueado: usuário SUSPENDED',
        metadata: {
          state: status.state,
          riskScore: status.riskScore,
          method,
          url,
        },
      })

      throw new ForbiddenException('Usuário suspenso temporariamente.')
    }

    // 🟡 WARNING: tudo passa (por enquanto)
    if (status.state === 'WARNING') {
      return true
    }

    // 🔴 RESTRICTED: só ações de regularização + leitura
    if (status.state === 'RESTRICTED') {
      const isGet = method === 'GET'

      // Decided by the declared route, never by the request URL (see RESTRICTED_REGULARIZATION_ROUTES).
      const route = declaredRoute(context)
      const isRegularizationPost =
        method === 'POST' &&
        route.method === RequestMethod.POST &&
        RESTRICTED_REGULARIZATION_ROUTES.has(route.path)

      const allowed = isGet || isRegularizationPost

      if (!allowed) {
        await this.timeline.log({
          orgId: user.orgId,
          action: 'OPERATIONAL_ACCESS_BLOCKED',
          personId: user.personId,
          description: 'Acesso bloqueado: usuário RESTRICTED',
          metadata: {
            state: status.state,
            riskScore: status.riskScore,
            method,
            url,
          },
        })

        throw new ForbiddenException('Ação bloqueada até regularização das pendências.')
      }

      return true
    }

    // 🟢 NORMAL
    return true
  }
}
