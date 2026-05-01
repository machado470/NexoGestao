import { Inject, Injectable, Logger, Optional } from '@nestjs/common'
import IORedis from 'ioredis'
import { QUEUE_CONNECTION } from '../../queue/queue.constants'

@Injectable()
export class IdempotencyCacheService {
  private readonly logger = new Logger(IdempotencyCacheService.name)
  private readonly memory = new Map<string, string>()

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
    if (this.redis) {
      try {
        await this.redis.set(`idem:${key}`, value, 'EX', ttlSeconds)
        return
      } catch {
        this.logger.warn('Falha ao salvar idempotência no Redis (fallback memória).')
      }
    }
    this.memory.set(key, value)
    setTimeout(() => this.memory.delete(key), ttlSeconds * 1000).unref?.()
  }
}
