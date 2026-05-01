import { IdempotencyInterceptor } from './idempotency.interceptor'
import { of, lastValueFrom } from 'rxjs'

describe('IdempotencyInterceptor', () => {
  it('reusa resposta em chamadas com mesma chave', async () => {
    const store = new Map<string, string>()
    const interceptor = new IdempotencyInterceptor({
      get: async (k: string) => store.get(k) ?? null,
      set: async (k: string, v: string) => void store.set(k, v),
    } as any)

    const ctx: any = {
      switchToHttp: () => ({ getRequest: () => ({ method: 'POST', originalUrl: '/whatsapp/messages', headers: { 'x-idempotency-key': 'abc' } }) }),
    }
    let executions = 0
    const handler: any = { handle: () => { executions++; return of({ ok: true }) } }
    await lastValueFrom(interceptor.intercept(ctx, handler))
    await lastValueFrom(interceptor.intercept(ctx, handler))
    expect(executions).toBe(1)
  })
})
