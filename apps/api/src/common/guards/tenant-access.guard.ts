import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common'
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'

export const ALLOW_CROSS_TENANT_KEY = 'allowCrossTenant'

/**
 * Marks a route whose `:orgId` route parameter legitimately targets another organization.
 * Only for routes already protected by an explicit cross-tenant authorization guard
 * (e.g. PlatformAdminGuard). Header, body and query organization ids are always enforced.
 */
export const AllowCrossTenantParam = () => SetMetadata(ALLOW_CROSS_TENANT_KEY, true)

const ORG_FIELDS = ['orgId', 'organizationId'] as const

function firstString(value: unknown): string {
  if (Array.isArray(value)) return firstString(value[0])
  return typeof value === 'string' ? value.trim() : ''
}

/** Every non-empty string a client sent for a field (query strings may repeat keys). */
function providedValues(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value]
  return list.map((item) => (typeof item === 'string' || typeof item === 'number' ? String(item).trim() : '')).filter(Boolean)
}

/**
 * The authenticated organization is the only tenant a request may act on. Any organization id
 * supplied by the client (x-org-id header, body, query string or `:orgId` route parameter) must
 * match it. Requests without an authenticated user are left to the route's own authentication.
 */
export function assertTenantAccess(request: any, options: { allowCrossTenantParam?: boolean } = {}) {
  if (!request?.user) return

  const userOrgId = firstString(request.user.orgId)
  if (!userOrgId) {
    throw new ForbiddenException('Organização ausente no token autenticado.')
  }

  if (providedValues(request.headers?.['x-org-id']).some((value) => value !== userOrgId)) {
    throw new ForbiddenException('x-org-id divergente da organização autenticada.')
  }

  const sources: Array<[string, unknown]> = [['Payload', request.body], ['Query', request.query]]
  if (!options.allowCrossTenantParam) sources.push(['Rota', request.params])

  for (const [label, source] of sources) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue
    for (const field of ORG_FIELDS) {
      if (providedValues((source as Record<string, unknown>)[field]).some((value) => value !== userOrgId)) {
        throw new ForbiddenException(`${label} com organização inválida para o usuário autenticado.`)
      }
    }
  }
}

/**
 * Global tenant check. It is an interceptor (not a global guard) on purpose: Nest runs global
 * guards before controller-level guards, so a global guard ran before JwtAuthGuard populated
 * `request.user` and silently skipped every check. Interceptors run after all guards.
 */
@Injectable()
export class TenantAccessInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const allowCrossTenantParam = this.reflector.getAllAndOverride<boolean>(ALLOW_CROSS_TENANT_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
      assertTenantAccess(context.switchToHttp().getRequest(), { allowCrossTenantParam: Boolean(allowCrossTenantParam) })
    }
    return next.handle()
  }
}

/** Global registration used by AppModule (after OrgContextInterceptor). */
export const TENANT_ACCESS_INTERCEPTOR_PROVIDER = { provide: APP_INTERCEPTOR, useClass: TenantAccessInterceptor }
