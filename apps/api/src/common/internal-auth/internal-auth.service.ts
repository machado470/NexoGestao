import { createHash } from 'crypto'
import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type IORedis from 'ioredis'
import { THROTTLE_REDIS_CLIENT_OPTIONS } from '../throttling/redis-throttler.storage'
import {
  INTERNAL_AUTH_HEADER,
  MAX_CLOCK_SKEW_SECONDS,
  NONCE_TTL_MS,
  bodyDigest,
  canonicalString,
  computeSignature,
  parseInternalAuthHeader,
  signaturesEqual,
} from './internal-auth.protocol'

/**
 * Verification result of the BFF internal-auth header. In C7.2d it is observed only: no guard,
 * throttler or authorization decision reads it, so every outcome other than "valid" simply means
 * "no internal context", never an error for the request and never extra privilege.
 */
export type InternalAuthStatus =
  | 'disabled'
  | 'missing'
  | 'malformed'
  | 'unknown_kid'
  | 'expired'
  | 'future'
  | 'bad_signature'
  | 'replay'
  | 'replay_check_unavailable'
  | 'valid'

export const INTERNAL_AUTH_STATUSES: InternalAuthStatus[] = [
  'disabled', 'missing', 'malformed', 'unknown_kid', 'expired', 'future', 'bad_signature', 'replay', 'replay_check_unavailable', 'valid',
]

export type InternalAuthMode = 'off' | 'observe'

export type InternalAuthConfig = {
  mode: InternalAuthMode
  /** kid -> key (current and previous during rotation). */
  keys: Map<string, Buffer>
  keyPrefix: string
}

const MIN_KEY_BYTES = 32
const MAX_KEYS = 3

/** Decodes base64/base64url strictly (round-trip check), or returns null. */
function decodeKey(raw: string): Buffer | null {
  const value = raw.trim()
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) return null
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  const decoded = Buffer.from(normalized, 'base64')
  if (decoded.toString('base64').replace(/=+$/, '') !== normalized) return null
  return decoded
}

/**
 * NEXO_INTERNAL_AUTH_MODE: off (default) | observe. Any other value fails the boot.
 * NEXO_INTERNAL_AUTH_KEYS: "kid:base64key[,kid:base64key]" (max 3, >= 32 bytes each), required
 * in observe mode. Error messages never include key material.
 */
export function readInternalAuthConfig(env: NodeJS.ProcessEnv = process.env): InternalAuthConfig {
  const rawMode = (env.NEXO_INTERNAL_AUTH_MODE ?? '').trim().toLowerCase()
  if (rawMode && rawMode !== 'off' && rawMode !== 'observe') {
    throw new Error('NEXO_INTERNAL_AUTH_MODE must be "off" or "observe"')
  }
  const mode = (rawMode || 'off') as InternalAuthMode
  const keyPrefix = `nexogestao:${(env.NODE_ENV ?? 'development').trim() || 'development'}:internal-auth:v1:`
  const keys = new Map<string, Buffer>()
  if (mode === 'off') return { mode, keys, keyPrefix }

  const entries = (env.NEXO_INTERNAL_AUTH_KEYS ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)
  if (!entries.length) throw new Error('NEXO_INTERNAL_AUTH_KEYS is required when NEXO_INTERNAL_AUTH_MODE=observe')
  if (entries.length > MAX_KEYS) throw new Error(`NEXO_INTERNAL_AUTH_KEYS accepts at most ${MAX_KEYS} keys`)
  for (const [index, entry] of entries.entries()) {
    const separator = entry.indexOf(':')
    const kid = separator > 0 ? entry.slice(0, separator) : ''
    const key = separator > 0 ? decodeKey(entry.slice(separator + 1)) : null
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(kid)) throw new Error(`NEXO_INTERNAL_AUTH_KEYS entry #${index + 1} has an invalid key id`)
    if (!key || key.length < MIN_KEY_BYTES) throw new Error(`NEXO_INTERNAL_AUTH_KEYS entry #${index + 1} must be base64 with at least ${MIN_KEY_BYTES} bytes`)
    if (keys.has(kid)) throw new Error(`NEXO_INTERNAL_AUTH_KEYS has a duplicated key id (entry #${index + 1})`)
    keys.set(kid, key)
  }
  return { mode, keys, keyPrefix }
}

type NonceClient = Pick<IORedis, 'set' | 'status' | 'connect' | 'quit' | 'disconnect' | 'on'>

export type VerifiableRequest = {
  method: string
  originalUrl?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  rawBody?: Buffer
}

/** Bounded counters (fixed statuses and configured kids only), summarized and reset per window. */
export class InternalAuthMetrics {
  private counts = new Map<string, number>()
  private total = 0
  record(status: InternalAuthStatus, kid: string | null) {
    this.total++
    const key = status === 'valid' && kid ? `valid:${kid}` : status
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1)
  }
  snapshot() {
    return { total: this.total, statuses: Object.fromEntries([...this.counts.entries()].sort()) }
  }
  drain() {
    const snapshot = this.snapshot()
    this.counts = new Map()
    this.total = 0
    return snapshot
  }
}

export const INTERNAL_AUTH_SUMMARY_INTERVAL_MS = 15 * 60 * 1000

export class InternalAuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('InternalAuth')
  readonly metrics = new InternalAuthMetrics()
  private timer?: NodeJS.Timeout
  private initialization?: Promise<void>
  private destroyed = false

  constructor(
    readonly config: InternalAuthConfig,
    private readonly redis: NonceClient | null,
    private readonly now: () => number = () => Date.now(),
    private readonly log: (line: string) => void = (line) => console.info(line),
    private readonly summaryIntervalMs = INTERNAL_AUTH_SUMMARY_INTERVAL_MS,
  ) {
    if (config.mode === 'observe' && !redis) throw new Error('NEXO_INTERNAL_AUTH_MODE=observe requires a Redis connection (REDIS_URL)')
    // Without a listener ioredis reports failed reconnects as unhandled 'error' events.
    redis?.on('error', () => undefined)
  }

  /** Factory used by the module: duplicates the queue connection with fail-fast options. */
  static fromEnvironment(queueConnection?: IORedis | null, env: NodeJS.ProcessEnv = process.env) {
    const config = readInternalAuthConfig(env)
    const redis = config.mode === 'observe' && queueConnection
      ? (queueConnection.duplicate({ ...THROTTLE_REDIS_CLIENT_OPTIONS, connectionName: 'nexogestao-internal-auth' }) as unknown as NonceClient)
      : null
    return new InternalAuthService(config, redis)
  }

  /** Idempotent: Nest may run hooks twice for the same instance. */
  onModuleInit(): Promise<void> {
    this.initialization ??= this.start()
    return this.initialization
  }

  private async start() {
    if (this.config.mode === 'off') return
    this.logger.log(`Autenticação interna BFF→API em modo observe (${this.config.keys.size} chave(s); nenhuma decisão depende dela)`)
    this.timer = setInterval(() => this.flushSummary(), this.summaryIntervalMs)
    this.timer.unref?.()
    await this.redis?.connect().catch(() => undefined)
  }

  flushSummary() {
    const snapshot = this.metrics.drain()
    if (snapshot.total === 0) return
    this.log(JSON.stringify({ level: 'info', message: 'internal_auth_summary', event: 'internal_auth_summary', mode: this.config.mode, windowMs: this.summaryIntervalMs, ...snapshot }))
  }

  async onModuleDestroy() {
    if (this.destroyed) return
    this.destroyed = true
    if (this.timer) clearInterval(this.timer)
    if (!this.redis) return
    if (this.redis.status === 'ready') {
      try { await this.redis.quit(); return } catch { /* fall through */ }
    }
    this.redis.disconnect()
  }

  /** Never throws. Signature is checked before the nonce is consumed (nobody can burn nonces). */
  async verify(req: VerifiableRequest): Promise<{ status: InternalAuthStatus; kid: string | null }> {
    if (this.config.mode === 'off') return { status: 'disabled', kid: null }
    const raw = req.headers?.[INTERNAL_AUTH_HEADER]
    if (raw === undefined) return { status: 'missing', kid: null }
    const parsed = Array.isArray(raw) ? null : parseInternalAuthHeader(raw)
    if (!parsed) return { status: 'malformed', kid: null }
    const key = this.config.keys.get(parsed.kid)
    if (!key) return { status: 'unknown_kid', kid: null }
    const nowSeconds = Math.floor(this.now() / 1000)
    if (parsed.ts < nowSeconds - MAX_CLOCK_SKEW_SECONDS) return { status: 'expired', kid: parsed.kid }
    if (parsed.ts > nowSeconds + MAX_CLOCK_SKEW_SECONDS) return { status: 'future', kid: parsed.kid }
    const canonical = canonicalString({
      kid: parsed.kid,
      ts: parsed.ts,
      nonce: parsed.nonce,
      method: req.method ?? '',
      target: req.originalUrl ?? req.url ?? '',
      bodySha256: bodyDigest(req.rawBody),
    })
    if (!canonical || !signaturesEqual(computeSignature(key, canonical), parsed.sig)) return { status: 'bad_signature', kid: parsed.kid }
    // Atomic single use across replicas. Redis unavailable => not verified (treated as absent).
    try {
      if (!this.redis || this.redis.status !== 'ready') return { status: 'replay_check_unavailable', kid: parsed.kid }
      const nonceKey = `${this.config.keyPrefix}nonce:${createHash('sha256').update(`${parsed.kid}|${parsed.nonce}`).digest('hex')}`
      const stored = await this.redis.set(nonceKey, '1', 'PX', NONCE_TTL_MS, 'NX')
      return stored === 'OK' ? { status: 'valid', kid: parsed.kid } : { status: 'replay', kid: parsed.kid }
    } catch {
      return { status: 'replay_check_unavailable', kid: parsed.kid }
    }
  }
}
