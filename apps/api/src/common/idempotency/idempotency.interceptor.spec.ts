import { CallHandler, ExecutionContext } from '@nestjs/common'
import { of } from 'rxjs'
import { IdempotencyInterceptor } from './idempotency.interceptor'

describe('IdempotencyInterceptor', () => {
  function makeContext(key = 'abc') {
    const req: any = { method: 'POST', originalUrl: '/x', headers: { 'x-idempotency-key': key } }
    const res: any = { statusCode: 201, status: jest.fn().mockReturnThis() }
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext
    return { ctx, req, res }
  }

  it('executes once and caches response', async () => {
    const cache: any = {
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(undefined),
      setResponse: jest.fn().mockResolvedValue(undefined),
    }
    const interceptor = new IdempotencyInterceptor(cache)
    const { ctx } = makeContext()
    const next: CallHandler = { handle: () => of({ ok: true }) }

    const result = await new Promise<any>((resolve) => interceptor.intercept(ctx, next).subscribe(resolve))

    expect(result).toEqual({ ok: true })
    expect(cache.acquireLock).toHaveBeenCalledTimes(1)
    expect(cache.setResponse).toHaveBeenCalledTimes(1)
    expect(cache.releaseLock).toHaveBeenCalledTimes(1)
  })

  it('returns cached response when lock exists', async () => {
    const cache: any = {
      acquireLock: jest.fn().mockResolvedValue(false),
      getResponse: jest.fn().mockResolvedValue({ statusCode: 202, payload: { replay: true } }),
    }
    const interceptor = new IdempotencyInterceptor(cache)
    const { ctx, res } = makeContext()
    const next: CallHandler = { handle: jest.fn(() => of({ shouldNot: 'run' })) }

    const result = await new Promise<any>((resolve) => interceptor.intercept(ctx, next).subscribe(resolve))

    expect(result).toEqual({ replay: true })
    expect(res.status).toHaveBeenCalledWith(202)
    expect(next.handle).not.toHaveBeenCalled()
  })
})
