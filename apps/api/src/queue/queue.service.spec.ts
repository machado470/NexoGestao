import { QueueService } from './queue.service'

describe('QueueService tracing metadata', () => {
  function createService(ctx: { requestId: string | null; correlationId: string | null }) {
    return new QueueService(
      { status: 'ready' } as any,
      {} as any,
      { increment: jest.fn(), setGauge: jest.fn(), observeDuration: jest.fn() } as any,
      ctx as any,
    )
  }

  it('propaga correlationId/requestId do contexto ao payload do job', () => {
    const service = createService({ requestId: 'req-1', correlationId: 'corr-1' }) as any
    const payload = service.withRequestTracing({ deliveryId: 'd-1' })
    expect(payload.requestId).toBe('req-1')
    expect(payload.correlationId).toBe('corr-1')
    expect(payload.meta).toEqual(expect.objectContaining({ requestId: 'req-1', correlationId: 'corr-1' }))
  })

  it('preserva ids saneados já enviados no payload', () => {
    const service = createService({ requestId: 'req-ctx', correlationId: 'corr-ctx' }) as any
    const payload = service.withRequestTracing({ deliveryId: 'd-1', requestId: 'req-ext', correlationId: 'corr-ext', meta: { requestId: 'req-meta' } })
    expect(payload.requestId).toBe('req-meta')
    expect(payload.correlationId).toBe('corr-ext')
    expect(payload.meta.requestId).toBe('req-meta')
    expect(payload.meta.correlationId).toBe('corr-ext')
  })
})
