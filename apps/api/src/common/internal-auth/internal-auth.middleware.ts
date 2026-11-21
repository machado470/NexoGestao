import { Injectable, NestMiddleware } from '@nestjs/common'
import { InternalAuthService, InternalAuthStatus } from './internal-auth.service'

/** Request annotation for observation only. Nothing in C7.2d grants or denies based on it. */
export const INTERNAL_AUTH_RESULT = Symbol('nexoInternalAuthResult')

/**
 * Verifies the BFF internal-auth header and counts the outcome. Never blocks, never throws,
 * never changes user authentication, throttling or the request itself; off mode costs nothing.
 */
@Injectable()
export class InternalAuthMiddleware implements NestMiddleware {
  constructor(private readonly internalAuth: InternalAuthService) {}

  async use(req: any, _res: unknown, next: () => void) {
    if (this.internalAuth.config.mode === 'off') return next()
    let status: InternalAuthStatus = 'missing'
    let kid: string | null = null
    try {
      ;({ status, kid } = await this.internalAuth.verify(req))
    } catch {
      status = 'replay_check_unavailable'
    }
    try {
      this.internalAuth.metrics.record(status, kid)
      Object.defineProperty(req, INTERNAL_AUTH_RESULT, { value: { status, kid }, enumerable: false })
    } catch {
      // Observation must never affect the request.
    }
    next()
  }
}
