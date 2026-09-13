import IORedis from 'ioredis'
import { Worker } from 'bullmq'
import { ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { QueueService } from '../../src/queue/queue.service'
import { HealthController } from '../../src/health/health.controller'
import { QueueObservabilityService } from '../../src/common/metrics/queue-observability.service'
import { QUEUE_NAMES } from '../../src/queue/queue.constants'
import { compose, eventually, assertDedicatedPhase23cInfrastructure } from './phase23c-harness'
import { describeRealIntegration, RUN_REAL_INTEGRATION, REAL_INTEGRATION_SKIP_REASON } from './infra-guards'

if (!RUN_REAL_INTEGRATION) console.warn(`[integration-skip] REAL REDIS / REAL BULLMQ: ${REAL_INTEGRATION_SKIP_REASON}`)

const producerOptions = { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 1_000 }
const workerOptions = { maxRetriesPerRequest: null, connectTimeout: 1_000 }

describeRealIntegration('Phase 2.3C — REAL REDIS / REAL BULLMQ down, recovery and stalled', () => {
  jest.setTimeout(120_000)
  let producerConnection: IORedis
  let queues: QueueService
  let metrics: QueueObservabilityService
  let health: HealthController
  const auxiliaryConnections = new Set<IORedis>()

  beforeAll(async () => {
    assertDedicatedPhase23cInfrastructure()
    producerConnection = new IORedis(process.env.REDIS_URL!, producerOptions)

    // QueueService is deliberately given the fail-fast producer. QueueEvents calls
    // duplicate(), so the harness supplies and tracks dedicated blocking connections
    // with BullMQ's required retry semantics without changing production settings.
    producerConnection.duplicate = (() => {
      const auxiliary = new IORedis(process.env.REDIS_URL!, workerOptions)
      auxiliaryConnections.add(auxiliary)
      return auxiliary
    }) as IORedis['duplicate']

    metrics = new QueueObservabilityService()
    queues = new QueueService(producerConnection, {} as any, metrics, { requestId: 'req-23c', correlationId: 'corr-23c' } as any)
    await queues.onModuleInit()
    health = new HealthController({ $queryRaw: async () => [{ '?column?': 1 }] } as any, new ConfigService(), queues)
  })

  beforeEach(async () => {
    await queues.getQueue(QUEUE_NAMES.AUTOMATION).obliterate({ force: true })
  })

  afterEach(async () => {
    await queues.getQueue(QUEUE_NAMES.AUTOMATION).obliterate({ force: true }).catch(() => undefined)
  })

  afterAll(async () => {
    let restoreError: unknown
    try {
      compose('redis-phase23c', 'start')
    } catch (error) {
      restoreError = error
    } finally {
      await queues?.getQueue(QUEUE_NAMES.AUTOMATION).obliterate({ force: true }).catch(() => undefined)
      await queues?.onModuleDestroy()
      for (const connection of auxiliaryConnections) {
        if (connection.status !== 'end') await connection.quit().catch(() => connection.disconnect())
      }
    }
    if (restoreError) throw restoreError
  })

  it('fails enqueue explicitly while Redis is down and processes a new job after automatic reconnect', async () => {
    let worker: Worker | undefined
    let workerConnection: IORedis | undefined
    try {
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
      await queues.getQueue(QUEUE_NAMES.AUTOMATION).drain()
      workerConnection = new IORedis(process.env.REDIS_URL!, workerOptions)
      const processed = new Promise<string>((resolve) => {
        worker = new Worker(QUEUE_NAMES.AUTOMATION, async (job) => job.name, { connection: workerConnection!, concurrency: 1 })
        worker.on('completed', (job) => resolve(job.name))
      })
      await queues.addJob(QUEUE_NAMES.AUTOMATION, 'phase23c-after', { fixture: true })
      await expect(processed).resolves.toBe('phase23c-after')
      expect((await queues.getQueueStatus()).ok).toBe(true)
      expect((await health.readiness()).status).toBe('ready')
    } finally {
      await worker?.close(true).catch(() => undefined)
      if (workerConnection?.status !== 'end') await workerConnection?.quit().catch(() => workerConnection?.disconnect())
    }
  })

  it('records a canonical queue stall through QueueService and then reprocesses the job', async () => {
    const queue = queues.getQueue(QUEUE_NAMES.AUTOMATION)
    let stalledWorker: Worker | undefined
    let recoveryWorker: Worker | undefined
    let stalledConnection: IORedis | undefined
    let recoveryConnection: IORedis | undefined
    const acquired = new Promise<void>((resolve) => {
      stalledConnection = new IORedis(process.env.REDIS_URL!, workerOptions)
      stalledWorker = new Worker(QUEUE_NAMES.AUTOMATION, async () => {
        resolve()
        await new Promise(() => undefined)
      }, {
        connection: stalledConnection,
        lockDuration: 500,
        stalledInterval: 500,
        maxStalledCount: 1,
      })
    })

    try {
      await queue.add('stall-once', {})
      await acquired
      await stalledWorker?.close(true)

      recoveryConnection = new IORedis(process.env.REDIS_URL!, workerOptions)
      recoveryWorker = new Worker(QUEUE_NAMES.AUTOMATION, async () => 'recovered', {
        connection: recoveryConnection,
        lockDuration: 500,
        stalledInterval: 500,
        maxStalledCount: 1,
      })

      const status = await eventually(
        () => queues.getQueueStatus(),
        (snapshot) => snapshot.ok === true && (snapshot.stalledEvents?.automation?.count ?? 0) >= 1,
        10_000,
      )
      expect(status.stalledEvents.automation.lastStalledAt).toBeDefined()
      expect(metrics.snapshot().counters['queue.job.stalled.automation']).toBeGreaterThanOrEqual(1)
      expect(metrics.snapshot().gauges).not.toHaveProperty('queue.backlog.stalled.automation')
      await eventually(() => queue.getJobCounts('completed'), (counts) => counts.completed === 1, 10_000)
    } finally {
      await stalledWorker?.close(true).catch(() => undefined)
      await recoveryWorker?.close(true).catch(() => undefined)
      if (stalledConnection?.status !== 'end') await stalledConnection?.quit().catch(() => stalledConnection?.disconnect())
      if (recoveryConnection?.status !== 'end') await recoveryConnection?.quit().catch(() => recoveryConnection?.disconnect())
      await queue.obliterate({ force: true }).catch(() => undefined)
    }
  })
})
