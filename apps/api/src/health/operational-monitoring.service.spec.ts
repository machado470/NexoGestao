import { OperationalMonitoringService } from './operational-monitoring.service'

describe('OperationalMonitoringService factual contract v2', () => {
  const originalEnv = process.env

  afterEach(() => { process.env = originalEnv })

  function createService(overrides: Record<string, any> = {}) {
    const queueService = {
      getQueueStatus: jest.fn().mockResolvedValue({
        ok: true,
        status: 'ready',
        queues: {
          notifications: { waiting: 31, active: 2, completed: 10, failed: 4, delayed: 7 },
          webhooks: { waiting: 0, active: 0, completed: 1, failed: 3, delayed: 0 },
          'webhooks-dlq': { waiting: 5, active: 0, completed: 0, failed: 0, delayed: 0 },
          'whatsapp-dlq': { waiting: 2, active: 0, completed: 0, failed: 0, delayed: 0 },
        },
        stalledEvents: { notifications: { count: 2, lastStalledAt: '2026-09-13T10:00:00.000Z' } },
      }),
      ...overrides.queueService,
    }
    const waMetrics = { snapshot: jest.fn().mockReturnValue({
      whatsapp_inbound_webhook_failed_total: 1,
      whatsapp_retry_total: 0,
      whatsapp_failed_jobs_total: 0,
      whatsapp_failed_webhook_total: 0,
    }) }
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ one: 1 }]), ...overrides.prisma }
    const pubSub = {
      readiness: jest.fn().mockReturnValue({ publisherReady: true, subscriberReady: true, subscribed: true, shuttingDown: false }),
      diagnostics: jest.fn().mockReturnValue({ publisherReady: true, subscriberReady: true, subscribed: true, shuttingDown: false }),
      ...overrides.pubSub,
    }
    const outbox = { factualSnapshot: jest.fn().mockResolvedValue({
      pending: 6, failed: 2, processing: 1, oldestPendingAt: new Date('2026-09-13T09:00:00.000Z'),
    }), ...overrides.outbox }
    const billing = { isStripeConfigured: true, ...overrides.billing }
    return new OperationalMonitoringService(queueService as any, waMetrics as any, prisma as any, pubSub as any, outbox as any, billing as any)
  }

  it('expõe delayed, DLQ, outbox e stalled conforme as fontes reais, sem threshold local', async () => {
    const snapshot = await createService().factualSnapshot()
    const queue = snapshot.dependencies.find(item => item.component === 'queue')!
    const outbox = snapshot.dependencies.find(item => item.component === 'outbox')!

    expect(snapshot.contractVersion).toBe(2)
    expect(queue).toMatchObject({
      availability: 'available',
      facts: {
        queues: { notifications: { waiting: 31, delayed: 7, failed: 4 } },
        dlqBacklog: { 'webhooks-dlq': 5, 'whatsapp-dlq': 2 },
        stalledEvents: { notifications: { count: 2, lastStalledAt: '2026-09-13T10:00:00.000Z' } },
      },
    })
    expect(outbox.facts).toMatchObject({ pending: 6, backlog: 6, failed: 2, processing: 1, oldestPendingAt: '2026-09-13T09:00:00.000Z' })

    const summary = await createService().summary()
    expect(summary.status).toBe('ok')
    expect(summary.degradedReasons).toEqual([])
    expect(JSON.stringify(summary)).not.toContain('backlog_waiting_threshold')
  })

  it('usa unknown sem fabricar contagens quando a coleta falha', async () => {
    const service = createService({
      queueService: { getQueueStatus: jest.fn().mockRejectedValue(new Error('collection failed')) },
      outbox: { factualSnapshot: jest.fn().mockRejectedValue(new Error('query failed')) },
    })
    const snapshot = await service.factualSnapshot()
    expect(snapshot.dependencies.find(item => item.component === 'queue')).toEqual(expect.objectContaining({ availability: 'unknown' }))
    expect(snapshot.dependencies.find(item => item.component === 'queue')).not.toHaveProperty('facts')
    expect(snapshot.dependencies.find(item => item.component === 'outbox')).toEqual(expect.objectContaining({ availability: 'unknown' }))
    expect(snapshot.dependencies.find(item => item.component === 'outbox')).not.toHaveProperty('facts')
  })

  it('expõe Pub/Sub indisponível como fato sem convertê-lo em dependência crítica', async () => {
    const down = { publisherReady: false, subscriberReady: false, subscribed: false, shuttingDown: false }
    const snapshot = await createService({ pubSub: { readiness: jest.fn().mockReturnValue(down), diagnostics: jest.fn().mockReturnValue(down) } }).factualSnapshot()
    expect(snapshot.dependencies.find(item => item.component === 'notification_pubsub')).toMatchObject({
      availability: 'unavailable',
      facts: { publisher: 'unavailable', subscriber: 'unavailable', subscription: 'unavailable' },
    })
  })

  it('separa configuração de disponibilidade runtime para WhatsApp real e Billing', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      WHATSAPP_PROVIDER: 'zapi',
      ZAPI_INSTANCE_ID: 'instance',
      ZAPI_TOKEN: 'token',
      ZAPI_CLIENT_TOKEN: 'client-token',
    }
    const configured = await createService().factualSnapshot()
    expect(configured.dependencies.find(item => item.component === 'whatsapp_provider')).toMatchObject({ configured: true, availability: 'unknown', facts: { providerResolved: 'zapi' } })
    expect(configured.dependencies.find(item => item.component === 'billing_stripe')).toMatchObject({ configured: true, availability: 'unknown' })

    const noBilling = await createService({ billing: { isStripeConfigured: false } }).factualSnapshot()
    expect(noBilling.dependencies.find(item => item.component === 'billing_stripe')).toMatchObject({ configured: false, availability: 'not_configured' })
  })
})
