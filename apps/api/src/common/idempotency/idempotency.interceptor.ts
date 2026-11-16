import { BadRequestException, CallHandler, ConflictException, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { createHash } from 'crypto'
import { defer, firstValueFrom, Observable } from 'rxjs'
import { CachedIdempotencyResponse, IdempotencyCacheService } from './idempotency-cache.service'

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly cache: IdempotencyCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest()
    const res = context.switchToHttp().getResponse()
    const key = String(req.headers['x-idempotency-key'] ?? req.headers['idempotency-key'] ?? '').trim()
    const orgId = req.user?.orgId
    // Never share a response cache between unauthenticated or different tenants.
    if (!key || !orgId) return next.handle()
    if (key.length > 200) throw new BadRequestException('Chave de idempotência muito longa')
    const scopeKey = `${orgId}:${req.method}:${req.originalUrl}:${key}`
    const canonical = JSON.stringify(req.body ?? null, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)
    const requestHash = createHash('sha256').update(canonical).digest('hex')
    const replay = (cached: CachedIdempotencyResponse) => {
      if (cached.requestHash && cached.requestHash !== requestHash) throw new ConflictException('Chave de idempotência já usada com conteúdo diferente')
      res.status(cached.statusCode)
      return cached.payload
    }

    return defer(async () => {
      const owned = await this.cache.acquireLock(scopeKey)
      if (!owned) {
        const cached = await this.cache.getResponse(scopeKey)
        if (cached) return replay(cached)
        throw new ConflictException('Solicitação ainda em processamento; tente novamente com a mesma chave')
      }
      try {
        // A completed response survives releasing the short-lived execution lock.
        const cached = await this.cache.getResponse(scopeKey)
        if (cached) return replay(cached)
        const payload = await firstValueFrom(next.handle())
        // Persist before publishing the response or releasing ownership.
        await this.cache.setResponse(scopeKey, { statusCode: Number(res.statusCode ?? 200), payload, requestHash })
        return payload
      } finally {
        await this.cache.releaseLock(scopeKey)
      }
    })
  }
}
