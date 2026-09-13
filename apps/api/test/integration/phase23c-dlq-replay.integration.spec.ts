import { createServer, Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import IORedis from 'ioredis'
import { PrismaService } from '../../src/prisma/prisma.service'
import { QueueService } from '../../src/queue/queue.service'
import { QueueObservabilityService } from '../../src/common/metrics/queue-observability.service'
import { WebhookService } from '../../src/webhooks/webhook.service'
import { WebhookProcessor } from '../../src/queue/processors/webhook.processor'
import { QUEUE_NAMES, WEBHOOK_QUEUE_JOB_NAMES } from '../../src/queue/queue.constants'
import { assertDedicatedPhase23cInfrastructure, eventually } from './phase23c-harness'
import { describeRealIntegration, RUN_REAL_INTEGRATION, REAL_INTEGRATION_SKIP_REASON } from './infra-guards'

if (!RUN_REAL_INTEGRATION) console.warn(`[integration-skip] REAL BULLMQ webhook DLQ/replay: ${REAL_INTEGRATION_SKIP_REASON}`)

describeRealIntegration('Phase 2.3C — REAL BULLMQ webhook DLQ, replay and tenant isolation', () => {
  jest.setTimeout(120_000)
  const orgA = randomUUID()
  const orgB = randomUUID()
  let prisma: PrismaService
  let redis: IORedis
  let queueService: QueueService
  let processor: WebhookProcessor
  let webhooks: WebhookService
  let metrics: QueueObservabilityService
  let server: Server
  let destinationHealthy = false
  let successfulEffects = 0
  let endpointId: string
  let deliveryId: string

  beforeAll(async () => {
    assertDedicatedPhase23cInfrastructure()
    server = createServer((request, response) => {
      request.resume()
      if (!destinationHealthy) { response.writeHead(503).end('controlled failure'); return }
      successfulEffects += 1
      response.writeHead(204).end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Fake webhook server did not bind')

    prisma = new PrismaService({ get: () => undefined } as any)
    await prisma.$connect()
    redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
    metrics = new QueueObservabilityService()
    queueService = new QueueService(redis, prisma, metrics, { requestId: 'request-A', correlationId: 'correlation-A' } as any)
    await queueService.onModuleInit()
    webhooks = new WebhookService(prisma, queueService)
    processor = new WebhookProcessor(redis, queueService, webhooks, metrics)
    await processor.onModuleInit()
    await prisma.organization.createMany({ data: [
      { id: orgA, name: 'Phase23C Org A', slug: `phase23c-a-${orgA}` },
      { id: orgB, name: 'Phase23C Org B', slug: `phase23c-b-${orgB}` },
    ] })
    const endpoint = await prisma.webhookEndpoint.create({ data: {
      orgId: orgA, url: `http://127.0.0.1:${address.port}/controlled`, secret: 'test-only', active: true, events: ['phase23c.test'],
    } })
    endpointId = endpoint.id
    const delivery = await webhooks.createPendingDelivery({
      endpointId, eventType: 'phase23c.test', idempotencyKey: `phase23c-${orgA}`,
      payload: { orgId: orgB, meta: { orgId: orgB, traceContext: { orgId: orgB, traceparent: 'invalid' } } },
    })
    deliveryId = delivery.id
  })

  afterAll(async () => {
    await processor?.onModuleDestroy()
    if (queueService) {
      for (const name of [QUEUE_NAMES.WEBHOOKS, QUEUE_NAMES.WEBHOOKS_DLQ]) {
        await queueService.getQueue(name).obliterate({ force: true }).catch(() => undefined)
      }
      await queueService.onModuleDestroy()
    }
    if (prisma) {
      await prisma.webhookEndpoint.deleteMany({ where: { orgId: { in: [orgA, orgB] } } }).catch(() => undefined)
      await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } }).catch(() => undefined)
      await prisma.$disconnect()
    }
    await new Promise<void>((resolve) => server?.close(() => resolve()))
  })

  it('exhausts real retries, persists FAILED, and dead-letters under the authoritative tenant', async () => {
    await queueService.addJob(QUEUE_NAMES.WEBHOOKS, WEBHOOK_QUEUE_JOB_NAMES.DISPATCH, {
      deliveryId, orgId: orgB, meta: { orgId: orgB, requestId: 'request-A', correlationId: 'correlation-A' },
    }, { attempts: 2, backoff: { type: 'fixed', delay: 100 }, jobId: `phase23c-initial-${deliveryId}` })

    const failed = await eventually(
      () => prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { endpoint: true } }),
      (delivery) => delivery?.status === 'FAILED', 30_000,
    )
    expect(failed).toMatchObject({ status: 'FAILED', attempts: 2, endpoint: { orgId: orgA } })
    expect(await queueService.getQueue(QUEUE_NAMES.WEBHOOKS_DLQ).getJobCountByTypes('waiting')).toBe(1)
    expect(metrics.snapshot().counters).toMatchObject({
      'webhook.dispatch.failed.total': 2,
      'webhook.dispatch.retry.total': 1,
      'webhook.dispatch.dlq.total': 1,
    })
    expect(await webhooks.listDeliveries(orgB)).toHaveLength(0)
    await expect(webhooks.replayFailedDelivery({ orgId: orgB, deliveryId, actorUserId: 'attacker-B' })).rejects.toThrow('não encontrado')
  })

  it('uses official replay, completes once, and rejects duplicate completed replay', async () => {
    destinationHealthy = true
    const replay = await webhooks.replayFailedDelivery({ orgId: orgA, deliveryId, actorUserId: 'operator-A' })
    expect(replay).toMatchObject({ ok: true, nextStatus: 'PENDING' })
    await eventually(() => prisma.webhookDelivery.findUnique({ where: { id: deliveryId } }), (delivery) => delivery?.status === 'SUCCESS')
    expect(successfulEffects).toBe(1)
    await expect(webhooks.replayFailedDelivery({ orgId: orgA, deliveryId, actorUserId: 'operator-A' })).rejects.toThrow('SUCCESS')
    expect(successfulEffects).toBe(1)
    expect((await webhooks.listDeliveries(orgA, { status: 'SUCCESS' })).map((item: any) => item.id)).toContain(deliveryId)
    expect(await webhooks.listDeliveries(orgA, { status: 'PENDING' })).toHaveLength(0)
  })
})
