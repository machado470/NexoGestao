import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import IORedis from 'ioredis'
import { QUEUE_CONNECTION } from '../../queue/queue.constants'

export type CachedIdempotencyResponse = {
  statusCode: number
  payload: unknown
}

@Injectable()
export class IdempotencyCacheService {
  private readonly logger = new Logger(IdempotencyCacheService.name)
  private readonly memory = new Map<string, string>()
  private readonly defaultTtlSeconds = Number(process.env.IDEMPOTENCY_CACHE_TTL_SECONDS ?? 600)
  private readonly lockTtlSeconds = Number(process.env.IDEMPOTENCY_LOCK_TTL_SECONDS ?? 45)

  constructor(@Optional() @Inject(QUEUE_CONNECTION) private readonly redis?: IORedis) {}

  async get(key: string) {
    if (this.redis) {
      try {
        return await this.redis.get(`idem:${key}`)
      } catch {
        this.logger.warn('Redis indisponível para idempotência (fallback memória).')
      }
    }
    return this.memory.get(key) ?? null
  }

  async set(key: string, value: string, ttlSeconds = 60 * 30) {
    const ttl = ttlSeconds > 0 ? ttlSeconds : this.defaultTtlSeconds
    if (this.redis) {
      try {
        await this.redis.set(`idem:${key}`, value, 'EX', ttl)
        return
      } catch {
        this.logger.warn('Falha ao salvar idempotência no Redis (fallback memória).')
      }
    }
    this.memory.set(key, value)
    setTimeout(() => this.memory.delete(key), ttl * 1000).unref?.()
  }

  async setResponse(key: string, value: CachedIdempotencyResponse) {
    await this.set(key, JSON.stringify(value), this.defaultTtlSeconds)
  }

  async getResponse(key: string): Promise<CachedIdempotencyResponse | null> {
    const raw = await this.get(key)
    if (!raw) return null

    try {
      return JSON.parse(raw) as CachedIdempotencyResponse
    } catch {
      return null
    }
  }

  async acquireLock(scopeKey: string): Promise<boolean> {
    const lockKey = `idempotency:lock:${scopeKey}`
    if (this.redis) {
      try {
        const result = await this.redis.set(
          lockKey,
          '1',
          'EX',
          this.lockTtlSeconds,
          'NX',
        )
        return result === 'OK'
      } catch {
        this.logger.warn('Falha ao adquirir lock Redis de idempotência (fallback memória).')
      }
    }

    if (this.memory.has(lockKey)) return false
    this.memory.set(lockKey, '1')
    setTimeout(() => this.memory.delete(lockKey), this.lockTtlSeconds * 1000).unref?.()
    return true
  }

  async releaseLock(scopeKey: string) {
    const lockKey = `idempotency:lock:${scopeKey}`
    if (this.redis) {
      try {
        await this.redis.del(lockKey)
        return
      } catch {
        this.logger.warn('Falha ao liberar lock Redis de idempotência (fallback memória).')
      }
    }
    this.memory.delete(lockKey)
  }
}
