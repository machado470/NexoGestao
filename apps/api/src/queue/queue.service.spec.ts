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

describe('QueueService degraded-mode safety', () => {
  function createService() {
    return new QueueService(
      { status: 'end' } as any,
      {} as any,
      {
        increment: jest.fn(),
        setGauge: jest.fn(),
        observeDuration: jest.fn(),
      } as any,
      {
        requestId: null,
        correlationId: null,
      } as any,
    ) as any
  }

  it('volta a tentar habilitar Redis depois de uma falha anterior', async () => {
    const service = createService()

    service.redisEnabled = false
    service.ensureRedisReady = jest.fn().mockResolvedValue(undefined)
    service.registerQueuesOnce = jest.fn()

    await expect(service.ensureEnabled()).resolves.toBe(true)

    expect(service.ensureRedisReady).toHaveBeenCalledTimes(1)
    expect(service.registerQueuesOnce).toHaveBeenCalledTimes(1)
    expect(service.redisEnabled).toBe(true)
  })

  it('não devolve job simulado quando Redis está indisponível', async () => {
    const service = createService()

    service.redisEnabled = false
    service.ensureEnabled = jest.fn().mockResolvedValue(false)

    await expect(
      service.addJob(
        'notifications' as any,
        'create-notification',
        { eventKey: 'evt-1' },
      ),
    ).rejects.toThrow()

    expect(service.ensureEnabled).toHaveBeenCalledTimes(1)
  })

  it('libera a promise de conexão depois de uma tentativa concluída', async () => {
    const service = createService()

    service.redisEnabled = true
    service.ensureRedisReadyInternal = jest.fn().mockResolvedValue(undefined)
    service.registerQueuesOnce = jest.fn()

    await expect(service.ensureEnabled()).resolves.toBe(true)

    expect(service.connectionInitPromise).toBeUndefined()

    service.ensureRedisReadyInternal.mockRejectedValueOnce(
      new Error('redis unavailable'),
    )

    await expect(service.ensureEnabled()).resolves.toBe(false)

    expect(service.ensureRedisReadyInternal).toHaveBeenCalledTimes(2)
    expect(service.redisEnabled).toBe(false)
  })

})

describe('QueueService factual queue snapshot', () => {
  it('expõe stalled como contador de eventos transitórios, não como gauge atual', async () => {
    const metrics = { increment: jest.fn(), setGauge: jest.fn(), observeDuration: jest.fn() }
    const service = new QueueService(
      { status: 'ready' } as any,
      {} as any,
      metrics as any,
      { requestId: null, correlationId: null } as any,
    ) as any
    const queue = { getJobCounts: jest.fn().mockResolvedValue({ waiting: 1, active: 2, completed: 3, failed: 4, delayed: 5 }) }
    for (const name of ['automation', 'notifications', 'whatsapp', 'whatsapp-dlq', 'finance', 'webhooks', 'webhooks-dlq']) {
      service.queueMap.set(name, queue)
    }
    service.stalledEvents.set('notifications', { count: 2, lastStalledAt: '2026-09-13T10:00:00.000Z' })

    await expect(service.getQueueStatus()).resolves.toMatchObject({
      ok: true,
      queues: { notifications: { delayed: 5, failed: 4 } },
      stalledEvents: { notifications: { count: 2, lastStalledAt: '2026-09-13T10:00:00.000Z' } },
    })
    expect(metrics.setGauge).not.toHaveBeenCalledWith(expect.stringContaining('stalled'), expect.anything())
    expect(metrics.setGauge).toHaveBeenCalledWith('queue.backlog.delayed.notifications', 5)
  })
})
