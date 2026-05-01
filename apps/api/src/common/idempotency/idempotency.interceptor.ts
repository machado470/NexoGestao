import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { Observable, defer, from, of } from 'rxjs'
import { finalize, switchMap, tap } from 'rxjs/operators'
import { IdempotencyCacheService } from './idempotency-cache.service'

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly cache: IdempotencyCacheService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest()
    const res = context.switchToHttp().getResponse()
    const key = String(req.headers['x-idempotency-key'] ?? '').trim()
    if (!key) return next.handle()

    const scopeKey = `${req.method}:${req.originalUrl}:${key}`
    return defer(() => from(this.cache.acquireLock(scopeKey))).pipe(
      switchMap((cached) => {
        if (!cached) {
          return from(this.cache.getResponse(scopeKey)).pipe(
            switchMap((existing) => {
              if (existing) {
                res.status(existing.statusCode)
                return of(existing.payload)
              }
              return next.handle()
            }),
          )
        }

        return next.handle().pipe(
          tap(async (payload) => {
            await this.cache.setResponse(scopeKey, {
              statusCode: Number(res.statusCode ?? 200),
              payload,
            })
          }),
          finalize(() => {
            void this.cache.releaseLock(scopeKey)
          }),
        )
      }),
    )
  }
}
