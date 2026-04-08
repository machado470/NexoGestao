import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'

@Injectable()
export class TenantAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const method = String(request.method ?? 'GET').toUpperCase()
    const userOrgId = request.user?.orgId as string | undefined
    const headerOrgId = (request.headers?.['x-org-id'] as string | undefined)?.trim()

    const isPublicRoute = !request.user
    if (isPublicRoute) return true

    if (!userOrgId) {
      throw new ForbiddenException('Organização ausente no token autenticado.')
    }

    if (headerOrgId && headerOrgId !== userOrgId) {
      throw new ForbiddenException('x-org-id divergente da organização autenticada.')
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const bodyOrgId = request.body?.orgId as string | undefined
      const bodyOrganizationId = request.body?.organizationId as string | undefined
      const providedOrgId = (bodyOrgId ?? bodyOrganizationId ?? '').trim()

      if (providedOrgId && providedOrgId !== userOrgId) {
        throw new ForbiddenException(
          'Payload com organização inválida para o usuário autenticado.',
        )
      }
    }

    return true
  }
}
