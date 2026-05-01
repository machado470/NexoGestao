import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable, from } from 'rxjs'
import { switchMap, tap } from 'rxjs/operators'
import { IdempotencyCacheService } from './idempotency-cache.service'

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly cache: IdempotencyCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest()
    const key = String(req.headers['x-idempotency-key'] ?? '').trim()
    if (!key) return next.handle()

    const scopeKey = `${req.method}:${req.originalUrl}:${key}`
    return from(this.cache.get(scopeKey)).pipe(
      switchMap((cached) => {
        if (cached) return from([JSON.parse(cached)])

        return next.handle().pipe(
          tap(async (response) => {
            await this.cache.set(scopeKey, JSON.stringify(response))
          }),
        )
      }),
    )
  }
}
