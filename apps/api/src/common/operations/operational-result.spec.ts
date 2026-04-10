import { buildOperationalResult } from './operational-result'

describe('operational-result', () => {
  it('monta envelope operacional com chaves de rastreabilidade', () => {
    const result = buildOperationalResult({
      status: 'executed',
      reason: 'ok',
      idempotencyKey: 'idem-1',
      executionKey: 'exec-1',
      requestId: 'req-1',
      correlationId: 'corr-1',
    })

    expect(result).toEqual({
      status: 'executed',
      reason: 'ok',
      idempotencyKey: 'idem-1',
      executionKey: 'exec-1',
      requestId: 'req-1',
      correlationId: 'corr-1',
    })
  })
})
