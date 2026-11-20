import { Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler'
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface'
import type IORedis from 'ioredis'

/**
 * Throttler counters shared by every API replica (C7.1).
 *
 * - Storage mode is opt-in: `THROTTLE_STORAGE=redis`. Unset/`memory` keeps the per-process
 *   counters of C7 and opens no Redis connection at all.
 * - Counters live in the Redis that already backs the queues (`REDIS_URL`), on one extra
 *   fail-fast connection duplicated from it. One Lua script increments, sets the TTL and the
 *   block atomically, with TTLs measured by Redis (no dependency on replica clocks).
 * - Keys are `<prefix>{<sha256>}:h|b`. The hash is produced by the guard from route, throttler
 *   and tracker, so no e-mail, token or IP is ever written to Redis.
 * - Failure policy when Redis does not answer (disconnected, timeout, error):
 *     common routes    -> per-process counters (protection degrades, never disappears);
 *     sensitive routes -> `THROTTLE_REDIS_SENSITIVE_FAILURE=closed` (default) answers 503,
 *                         `local` uses per-process counters like common routes.
 *   State changes are logged once (no URL, password or key material in logs).
 */
export type ThrottleStorageMode = 'memory' | 'redis'
export type SensitiveFailurePolicy = 'closed' | 'local'

/** Prefix the guard adds to keys of routes marked with SensitiveThrottle(). */
export const SENSITIVE_KEY_PREFIX = 'sensitive:'

export const THROTTLE_STORAGE_UNAVAILABLE_MESSAGE =
  'Proteção contra abuso temporariamente indisponível. Tente novamente em alguns segundos.'
export const THROTTLE_UNAVAILABLE_RETRY_AFTER_SECONDS = 5

export class ThrottlerStorageUnavailableException extends ServiceUnavailableException {
  constructor() {
    super({ statusCode: 503, code: 'RATE_LIMIT_UNAVAILABLE', message: THROTTLE_STORAGE_UNAVAILABLE_MESSAGE })
  }
}

/**
 * KEYS[1] hits counter, KEYS[2] block marker. ARGV: ttl ms, limit, block ms.
 * Returns { hits, hitsPttl, blocked, blockPttl }. While blocked, hits are not incremented.
 */
export const THROTTLE_HIT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local current = tonumber(redis.call('GET', KEYS[1]) or '0')
  return { current, redis.call('PTTL', KEYS[1]), 1, blockTtl }
end
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local block = tonumber(ARGV[3])
local hits = redis.call('INCR', KEYS[1])
local hitsTtl = redis.call('PTTL', KEYS[1])
if hits == 1 or hitsTtl < 0 then
  redis.call('PEXPIRE', KEYS[1], ttl)
  hitsTtl = ttl
end
if hits > limit then
  redis.call('SET', KEYS[2], '1', 'PX', block)
  return { hits, hitsTtl, 1, block }
end
return { hits, hitsTtl, 0, 0 }
`

type ThrottleRedisClient = Pick<IORedis, 'defineCommand' | 'status' | 'connect' | 'quit' | 'disconnect' | 'on' | 'once' | 'removeListener'> & {
  nexoThrottleHit?: (hitsKey: string, blockKey: string, ttl: number, limit: number, block: number) => Promise<unknown>
}

export type NexoThrottlerStorageOptions = {
  mode: ThrottleStorageMode
  /** Dedicated client. Required in redis mode; never the shared queue connection itself. */
  client?: ThrottleRedisClient | null
  sensitiveFailure?: SensitiveFailurePolicy
  keyPrefix?: string
  connectTimeoutMs?: number
}

export function readThrottleStorageConfig(env: NodeJS.ProcessEnv = process.env) {
  const rawMode = (env.THROTTLE_STORAGE ?? '').trim().toLowerCase()
  const rawFailure = (env.THROTTLE_REDIS_SENSITIVE_FAILURE ?? '').trim().toLowerCase()
  if (rawMode && rawMode !== 'redis' && rawMode !== 'memory') {
    throw new Error('THROTTLE_STORAGE must be "redis" or "memory"')
  }
  if (rawFailure && rawFailure !== 'closed' && rawFailure !== 'local') {
    throw new Error('THROTTLE_REDIS_SENSITIVE_FAILURE must be "closed" or "local"')
  }
  return {
    mode: (rawMode || 'memory') as ThrottleStorageMode,
    sensitiveFailure: (rawFailure || 'closed') as SensitiveFailurePolicy,
    keyPrefix: `nexogestao:${(env.NODE_ENV ?? 'development').trim() || 'development'}:throttle:v1:`,
  }
}

/** Fail-fast options for the throttler's own connection: a request must never wait on Redis. */
export const THROTTLE_REDIS_CLIENT_OPTIONS = {
  connectionName: 'nexogestao-throttler',
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  commandTimeout: 300,
  connectTimeout: 2_000,
  disconnectTimeout: 500,
  retryStrategy: (attempt: number) => Math.min(250 * 2 ** Math.min(attempt, 4), 5_000),
} as const

export class NexoThrottlerStorage implements ThrottlerStorage, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('NexoThrottlerStorage')
  private readonly local = new ThrottlerStorageService()
  private readonly client: ThrottleRedisClient | null
  readonly mode: ThrottleStorageMode
  readonly sensitiveFailure: SensitiveFailurePolicy
  private readonly keyPrefix: string
  private readonly connectTimeoutMs: number
  private redisHealthy: boolean | null = null
  private initialization?: Promise<void>
  private destroyed = false

  constructor(options: NexoThrottlerStorageOptions) {
    this.mode = options.mode
    this.sensitiveFailure = options.sensitiveFailure ?? 'closed'
    this.keyPrefix = options.keyPrefix ?? 'nexogestao:development:throttle:v1:'
    this.connectTimeoutMs = options.connectTimeoutMs ?? 3_000
    this.client = this.mode === 'redis' ? options.client ?? null : null
    if (this.mode === 'redis' && !this.client) {
      throw new Error('THROTTLE_STORAGE=redis requires a Redis connection (REDIS_URL)')
    }
    if (this.client) {
      this.client.defineCommand('nexoThrottleHit', { numberOfKeys: 2, lua: THROTTLE_HIT_SCRIPT })
      // Without a listener ioredis reports every failed reconnect as an unhandled 'error'.
      this.client.on('error', () => this.markUnhealthy())
      this.client.on('ready', () => this.markHealthy())
    }
  }

  /** Factory used by the application module: duplicates the existing queue connection. */
  static fromEnvironment(queueConnection?: IORedis | null, env: NodeJS.ProcessEnv = process.env) {
    const config = readThrottleStorageConfig(env)
    const client = config.mode === 'redis' && queueConnection
      ? (queueConnection.duplicate(THROTTLE_REDIS_CLIENT_OPTIONS) as unknown as ThrottleRedisClient)
      : null
    return new NexoThrottlerStorage({ ...config, client })
  }

  /**
   * Idempotent: Nest runs the hooks of this instance twice in the application (as our provider
   * and as the ThrottlerStorage provider returned from ThrottlerModule options).
   */
  onModuleInit(): Promise<void> {
    if (!this.client) return Promise.resolve()
    this.initialization ??= this.connectBounded()
    return this.initialization
  }

  private async connectBounded() {
    if (!this.client) return
    this.logger.log(`Contadores de rate limit compartilhados via Redis (falha em rota sensível: ${this.sensitiveFailure})`)
    // Bounded wait: boot proceeds (with the failure policy) if Redis is not reachable yet.
    const client = this.client
    let timer: NodeJS.Timeout | undefined
    let onReady: (() => void) | undefined
    await Promise.race([
      new Promise<void>((resolve) => { onReady = resolve; client.once('ready', resolve) }),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, this.connectTimeoutMs); timer.unref?.() }),
      client.connect().then(() => new Promise<never>(() => undefined), () => this.markUnhealthy()),
    ])
    if (timer) clearTimeout(timer)
    if (onReady) client.removeListener('ready', onReady)
    if (client.status === 'ready') this.markHealthy()
  }

  async onModuleDestroy() {
    this.local.onApplicationShutdown()
    if (!this.client || this.destroyed) return
    this.destroyed = true
    // QUIT only on a live connection; otherwise stop the reconnect loop right away.
    if (this.client.status === 'ready') {
      try {
        await this.client.quit()
        return
      } catch {
        // fall through
      }
    }
    this.client.disconnect()
  }

  get isRedisHealthy() {
    return this.redisHealthy === true
  }

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    if (!this.client || this.destroyed) return this.local.increment(key, ttl, limit, blockDuration, throttlerName)
    try {
      const record = await this.incrementInRedis(key, ttl, limit, blockDuration)
      this.markHealthy()
      return record
    } catch {
      this.markUnhealthy()
      if (key.startsWith(SENSITIVE_KEY_PREFIX) && this.sensitiveFailure === 'closed') {
        throw new ThrottlerStorageUnavailableException()
      }
      return this.local.increment(key, ttl, limit, blockDuration, throttlerName)
    }
  }

  /** Redis key names for a guard key (exported for tests and operations). */
  redisKeys(key: string) {
    const base = `${this.keyPrefix}{${key}}`
    return { hits: `${base}:h`, block: `${base}:b` }
  }

  private async incrementInRedis(key: string, ttl: number, limit: number, blockDuration: number): Promise<ThrottlerStorageRecord> {
    if (!this.client?.nexoThrottleHit || this.client.status !== 'ready') throw new Error('throttle redis not ready')
    const ttlMs = Math.max(1, Math.ceil(ttl))
    const blockMs = Math.max(1, Math.ceil(blockDuration || ttl))
    const { hits, block } = this.redisKeys(key)
    const reply = await this.client.nexoThrottleHit(hits, block, ttlMs, Math.max(0, Math.floor(limit)), blockMs)
    if (!Array.isArray(reply) || reply.length !== 4) throw new Error('unexpected throttle reply')
    const [totalHits, hitsPttl, blocked, blockPttl] = reply.map((value) => Number(value))
    if (![totalHits, hitsPttl, blocked, blockPttl].every(Number.isFinite)) throw new Error('unexpected throttle reply')
    return {
      totalHits,
      timeToExpire: Math.max(0, Math.ceil(hitsPttl / 1000)),
      isBlocked: blocked === 1,
      timeToBlockExpire: blocked === 1 ? Math.max(1, Math.ceil(blockPttl / 1000)) : 0,
    }
  }

  private markHealthy() {
    if (this.redisHealthy === true) return
    if (this.redisHealthy === false) this.logger.log('Redis de rate limit restabelecido; contadores compartilhados reativados')
    this.redisHealthy = true
  }

  private markUnhealthy() {
    if (this.redisHealthy === false) return
    this.redisHealthy = false
    this.logger.warn(
      `Redis de rate limit indisponível: rotas comuns usam contadores locais por réplica; rotas sensíveis ${this.sensitiveFailure === 'closed' ? 'respondem 503' : 'usam contadores locais'}`,
    )
  }
}
