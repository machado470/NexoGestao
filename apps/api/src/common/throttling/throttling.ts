import { createHash } from 'crypto'
import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ThrottlerGuard, ThrottlerOptions } from '@nestjs/throttler'
import type { ThrottlerRequest } from '@nestjs/throttler/dist/throttler.guard.interface'
import { resolveJwtSecret } from '../../auth/jwt-secret'
import { SENSITIVE_KEY_PREFIX, THROTTLE_UNAVAILABLE_RETRY_AFTER_SECONDS, ThrottlerStorageUnavailableException } from './redis-throttler.storage'

/**
 * Rate limiting policy.
 *
 * Every browser request reaches this API through the web BFF, so `req.ip` is the BFF's address
 * for all users (and Railway's edge for public callers). Per-IP limits were therefore shared by
 * the whole platform. Limits are now counted per authenticated user; anonymous credential
 * routes are counted per account/token, under a coarse per-IP ceiling. `trust proxy` is NOT
 * enabled, so a client-supplied X-Forwarded-For can never select or reset a bucket.
 */
export const DEFAULT_THROTTLER = 'default'
export const ANONYMOUS_THROTTLER = 'anonymous'
export const MINUTE_MS = 60_000

export const THROTTLERS: ThrottlerOptions[] = [
  // Per user (verified JWT) or, without a valid session, per peer IP.
  { name: DEFAULT_THROTTLER, ttl: MINUTE_MS, limit: 10 },
  // Ceiling for requests without a valid session, per peer IP. Authenticated requests skip it.
  { name: ANONYMOUS_THROTTLER, ttl: MINUTE_MS, limit: 300 },
]

/** Credential endpoints: ceiling on anonymous attempts per peer IP (platform-wide behind the BFF). */
export const AUTH_ANONYMOUS_LIMIT = 100

/** Skips every configured throttler (SkipThrottle() alone only skips "default"). */
export const SKIP_ALL_THROTTLERS = { [DEFAULT_THROTTLER]: true, [ANONYMOUS_THROTTLER]: true }

/**
 * Marks credential and payment routes. With shared (Redis) counters, these routes follow
 * THROTTLE_REDIS_SENSITIVE_FAILURE when Redis is unavailable instead of per-process counters.
 */
export const SENSITIVE_THROTTLE = 'nexo:throttle:sensitive'
export const SensitiveThrottle = () => SetMetadata(SENSITIVE_THROTTLE, true)

const IDENTITY = Symbol('nexoThrottleIdentity')

const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 32)

function rawSessionToken(req: Record<string, any>): string | null {
  const header = req?.headers?.authorization
  if (typeof header === 'string' && /^bearer\s+/i.test(header)) {
    const token = header.replace(/^bearer\s+/i, '').trim()
    if (token) return token
  }
  const queryToken = req?.query?.token
  return typeof queryToken === 'string' && queryToken.trim() ? queryToken.trim() : null
}

export function peerTracker(req: Record<string, any>): string {
  // req.ip is the socket peer: X-Forwarded-For is ignored because trust proxy is off.
  return `ip:${String(req?.ip ?? req?.socket?.remoteAddress ?? 'unknown')}`
}

/** Per-route tracker keyed by a normalized body field (account email or one-time token), hashed. */
export function bodyFieldTracker(field: string, options: { lowercase?: boolean } = {}) {
  return (req: Record<string, any>): string => {
    const raw = req?.body?.[field]
    if (typeof raw !== 'string' || !raw.trim()) return peerTracker(req)
    const value = options.lowercase ? raw.trim().toLowerCase() : raw.trim()
    return `${field}:${digest(value)}`
  }
}

export const accountEmailTracker = bodyFieldTracker('email', { lowercase: true })
export const bodyTokenTracker = bodyFieldTracker('token')
export const bodyIdTokenTracker = bodyFieldTracker('idToken')

@Injectable()
export class NexoThrottlerGuard extends ThrottlerGuard {
  private jwt?: JwtService | null

  /** Verified session identity (signature + expiry only; JwtAuthGuard still authenticates). */
  protected sessionIdentity(req: Record<string | symbol, any>): string | null {
    if (req && IDENTITY in req) return req[IDENTITY] as string | null
    let identity: string | null = null
    const token = rawSessionToken(req)
    if (token) {
      try {
        const payload = this.verifier()?.verify<{ sub?: string; orgId?: string }>(token)
        if (payload && typeof payload.sub === 'string' && payload.sub) {
          identity = `user:${typeof payload.orgId === 'string' ? payload.orgId : '-'}:${payload.sub}`
        }
      } catch {
        identity = null
      }
    }
    if (req) req[IDENTITY] = identity
    return identity
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return this.sessionIdentity(req) ?? peerTracker(req)
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    try {
      if (requestProps.throttler.name === ANONYMOUS_THROTTLER) {
        const req = requestProps.context.switchToHttp().getRequest()
        if (this.sessionIdentity(req)) return true
        // The anonymous ceiling is always per peer IP, even where a route keys "default" by account.
        return await super.handleRequest({ ...requestProps, getTracker: (r: Record<string, any>) => peerTracker(r) })
      }
      return await super.handleRequest(requestProps)
    } catch (error) {
      if (error instanceof ThrottlerStorageUnavailableException) {
        const { res } = this.getRequestResponse(requestProps.context)
        this.setResponseHeader(res, 'Retry-After', THROTTLE_UNAVAILABLE_RETRY_AFTER_SECONDS)
      }
      throw error
    }
  }

  /** Same hashed key as the library; sensitive routes are tagged so storage applies their failure policy. */
  protected generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const key = super.generateKey(context, suffix, name)
    const sensitive = this.reflector.getAllAndOverride<boolean>(SENSITIVE_THROTTLE, [context.getHandler(), context.getClass()])
    return sensitive ? `${SENSITIVE_KEY_PREFIX}${key}` : key
  }

  private verifier(): JwtService | null {
    if (this.jwt !== undefined) return this.jwt
    try {
      this.jwt = new JwtService({ secret: resolveJwtSecret({ get: (key: string) => process.env[key] } as any) })
    } catch {
      this.jwt = null
    }
    return this.jwt
  }
}

