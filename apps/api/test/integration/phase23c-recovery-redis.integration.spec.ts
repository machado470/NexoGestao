import IORedis from 'ioredis'
import { Queue, QueueEvents, Worker } from 'bullmq'
import { ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { QueueService } from '../../src/queue/queue.service'
import { HealthController } from '../../src/health/health.controller'
import { QueueObservabilityService } from '../../src/common/metrics/queue-observability.service'
import { QUEUE_NAMES } from '../../src/queue/queue.constants'
import { compose, eventually, assertDedicatedPhase23cInfrastructure } from './phase23c-harness'
import { describeRealIntegration, RUN_REAL_INTEGRATION, REAL_INTEGRATION_SKIP_REASON } from './infra-guards'

if (!RUN_REAL_INTEGRATION) console.warn(`[integration-skip] REAL REDIS / REAL BULLMQ: ${REAL_INTEGRATION_SKIP_REASON}`)

const redisOptions = { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 1_000 }

describeRealIntegration('Phase 2.3C — REAL REDIS / REAL BULLMQ down, recovery and stalled', () => {
  jest.setTimeout(120_000)
  let connection: IORedis
  let queues: QueueService
  let metrics: QueueObservabilityService
  let health: HealthController

  beforeAll(async () => {
    assertDedicatedPhase23cInfrastructure()
    connection = new IORedis(process.env.REDIS_URL!, redisOptions)
    metrics = new QueueObservabilityService()
    queues = new QueueService(connection, {} as any, metrics, { requestId: 'req-23c', correlationId: 'corr-23c' } as any)
    await queues.onModuleInit()
    health = new HealthController({ $queryRaw: async () => [{ '?column?': 1 }] } as any, new ConfigService(), queues)
  })

  afterAll(async () => {
    compose('redis-phase23c', 'start')
    await queues?.onModuleDestroy()
  })

  it('fails enqueue explicitly while Redis is down and processes a new job after automatic reconnect', async () => {
    expect((await health.readiness()).status).toBe('ready')
    const first = await queues.addJob(QUEUE_NAMES.AUTOMATION, 'phase23c-before', { fixture: true })
    expect(first.id).toBeDefined()
    compose('redis-phase23c', 'stop')
    await eventually(async () => queues.getQueueStatus(), (status) => status.ok === false)
    await expect(health.readiness()).rejects.toBeInstanceOf(ServiceUnavailableException)
    await expect(queues.addJob(QUEUE_NAMES.AUTOMATION, 'phase23c-during', { fixture: true }))
      .rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(metrics.snapshot().counters[`queue.job.enqueue.failed.${QUEUE_NAMES.AUTOMATION}`]).toBeGreaterThanOrEqual(1)

    compose('redis-phase23c', 'start')
    await eventually(() => queues.ensureEnabled(), Boolean, 30_000)
    const processed = new Promise<string>((resolve) => {
      const worker = new Worker(QUEUE_NAMES.AUTOMATION, async (job) => job.name, { connection, concurrency: 1 })
      worker.on('completed', async (job) => { resolve(job.name); await worker.close() })
    })
    await queues.addJob(QUEUE_NAMES.AUTOMATION, 'phase23c-after', { fixture: true })
    await expect(processed).resolves.toBe('phase23c-after')
    expect((await queues.getQueueStatus()).ok).toBe(true)
    expect((await health.readiness()).status).toBe('ready')
  })

  it('observes a real BullMQ stalled event with harness-only lock intervals', async () => {
    const queueName = `phase23c-stalled-${Date.now()}`
    const isolated = connection.duplicate()
    const queue = new Queue(queueName, { connection: isolated })
    const events = new QueueEvents(queueName, { connection: isolated })
    await events.waitUntilReady()
    let stalledEvents = 0
    let lastStalledAt: string | undefined
    events.on('stalled', () => { stalledEvents += 1; lastStalledAt = new Date().toISOString() })
    const acquired = new Promise<void>((resolve) => {
      const worker = new Worker(queueName, async () => { resolve(); await new Promise(() => undefined) }, {
        connection: isolated, lockDuration: 500, stalledInterval: 500, maxStalledCount: 1,
      })
      ;(acquired as any).worker = worker
    })
    try {
      await queue.add('stall-once', {})
      await acquired
      await (acquired as any).worker.close(true)
      const recoveryWorker = new Worker(queueName, async () => 'recovered', {
        connection: isolated, lockDuration: 500, stalledInterval: 500, maxStalledCount: 1,
      })
      await eventually(async () => stalledEvents, (count) => count > 0, 10_000)
      await eventually(() => queue.getJobCounts('completed'), (counts) => counts.completed === 1, 10_000)
      expect(lastStalledAt).toBeDefined()
      expect(metrics.snapshot().gauges).not.toHaveProperty(`queue.backlog.stalled.${queueName}`)
      await recoveryWorker.close()
    } finally {
      await (acquired as any).worker?.close(true).catch(() => undefined)
      await queue.obliterate({ force: true }).catch(() => undefined)
      await events.close()
      await queue.close()
      await isolated.quit()
    }
  })
})
