import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'

export const PLATFORM_ADMIN_USER_IDS_ENV = 'PLATFORM_ADMIN_USER_IDS'

/**
 * Parses the explicit allowlist of platform operators (comma/whitespace separated user ids).
 * Read on every request so a revoked id stops working without a code change.
 */
export function platformAdminUserIds(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(
    (env[PLATFORM_ADMIN_USER_IDS_ENV] ?? '')
      .split(/[\s,]+/)
      .map((id) => id.trim())
      .filter(Boolean),
  )
}

/**
 * Cross-tenant (platform) administration guard.
 *
 * The `ADMIN` role belongs to a customer organization and must never grant access to data
 * or settings of other organizations. Platform operators are identified by an explicit,
 * server-side allowlist of user ids (`PLATFORM_ADMIN_USER_IDS`) and must also still be an
 * active `ADMIN` in their own organization. Deny by default: an empty allowlist blocks all.
 *
 * Must run after `JwtAuthGuard`, which loads `req.user` from the persisted session.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest()?.user
    const userId = typeof user?.userId === 'string' ? user.userId : undefined

    if (!userId || user?.role !== 'ADMIN' || !platformAdminUserIds().has(userId)) {
      throw new ForbiddenException('Acesso restrito à administração da plataforma.')
    }

    return true
  }
}
