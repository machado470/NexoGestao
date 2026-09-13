import IORedis from 'ioredis'
import { Worker } from 'bullmq'
import { ChildProcess, fork } from 'node:child_process'
import { join } from 'node:path'
import { ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { QueueService } from '../../src/queue/queue.service'
import { HealthController } from '../../src/health/health.controller'
import { QueueObservabilityService } from '../../src/common/metrics/queue-observability.service'
import { QUEUE_NAMES } from '../../src/queue/queue.constants'
import { compose, eventually, assertDedicatedPhase23cInfrastructure, waitRedisClientsReady, waitRedisReachable } from './phase23c-harness'
import { describeRealIntegration, RUN_REAL_INTEGRATION, REAL_INTEGRATION_SKIP_REASON } from './infra-guards'

if (!RUN_REAL_INTEGRATION) console.warn(`[integration-skip] REAL REDIS / REAL BULLMQ: ${REAL_INTEGRATION_SKIP_REASON}`)

const producerOptions = { maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 1_000 }
const workerOptions = { maxRetriesPerRequest: null, connectTimeout: 1_000 }

type ChildExit = { exitCode: number | null, signalCode: NodeJS.Signals | null }

function waitForChildExit(child: ChildProcess, timeoutMs = 5_000): Promise<ChildExit> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ exitCode: child.exitCode, signalCode: child.signalCode })
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`child did not exit within ${timeoutMs}ms`)), timeoutMs)
    child.once('exit', (exitCode, signalCode) => {
      clearTimeout(timeout)
      resolve({ exitCode, signalCode })
    })
  })
}

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = 30_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    promise.then(
      (value) => { clearTimeout(timeout); resolve(value) },
      (error) => { clearTimeout(timeout); reject(error) },
    )
  })
}

describeRealIntegration('Phase 2.3C — REAL REDIS / REAL BULLMQ down, recovery and stalled', () => {
  jest.setTimeout(120_000)
  let producerConnection: IORedis
  let queues: QueueService
  let metrics: QueueObservabilityService
  let health: HealthController
  let outageServiceDestroyed = false
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

  afterAll(async () => {
    let restoreError: unknown
    try {
      compose('redis-phase23c', 'start')
    } catch (error) {
      restoreError = error
    } finally {
      await queues?.getQueue(QUEUE_NAMES.AUTOMATION).obliterate({ force: true }).catch(() => undefined)
      if (!outageServiceDestroyed) await queues?.onModuleDestroy()
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
      await queues.getQueue(QUEUE_NAMES.AUTOMATION).obliterate({ force: true })
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
      // Leave Redis healthy even when an assertion fails after the deliberate stop,
      // so the independently constructed stalled scenario never inherits outage state.
      compose('redis-phase23c', 'start')
      await worker?.close(true).catch(() => undefined)
      if (workerConnection?.status !== 'end') await workerConnection?.quit().catch(() => workerConnection?.disconnect())
      await queues.getQueue(QUEUE_NAMES.AUTOMATION).obliterate({ force: true }).catch(() => undefined)
      await queues.onModuleDestroy()
      outageServiceDestroyed = true
    }
  })

  it('records a canonical queue stall through QueueService and then reprocesses the job', async () => {
    await waitRedisReachable(process.env.REDIS_URL!, 30_000)

    const stalledAuxiliaryConnections = new Set<IORedis>()
    const stalledProducer = new IORedis(process.env.REDIS_URL!, producerOptions)
    stalledProducer.duplicate = (() => {
      const auxiliary = new IORedis(process.env.REDIS_URL!, workerOptions)
      stalledAuxiliaryConnections.add(auxiliary)
      return auxiliary
    }) as IORedis['duplicate']
    const stalledMetrics = new QueueObservabilityService()
    const stalledQueues = new QueueService(stalledProducer, {} as any, stalledMetrics, { requestId: 'req-23c-stalled', correlationId: 'corr-23c-stalled' } as any)
    await stalledQueues.onModuleInit()
    await waitRedisClientsReady(stalledAuxiliaryConnections, 20_000)
    const queue = stalledQueues.getQueue(QUEUE_NAMES.AUTOMATION)
    await queue.obliterate({ force: true })
    let stalledChild: ChildProcess | undefined
    let childExit: ChildExit | undefined
    let recoveryWorker: Worker | undefined
    let recoveryConnection: IORedis | undefined
    let workerStalledJobId: string | undefined
    let completedJobId: string | undefined
    let workerCompleted: Promise<string> | undefined
    let originalJobId: string | undefined

    try {
      const acquired = new Promise<string>((resolve, reject) => {
        stalledChild = fork(join(__dirname, 'fixtures/phase23c-stalled-worker.js'), [], {
          env: { ...process.env, REDIS_URL: process.env.REDIS_URL! },
          stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
        })
        stalledChild.once('error', reject)
        stalledChild.on('message', (message: { type?: string, jobId?: string, message?: string }) => {
          if (message.type === 'acquired' && message.jobId) resolve(message.jobId)
          if (message.type === 'error') reject(new Error(`stalled child worker: ${message.message}`))
        })
      })
      const job = await queue.add('stall-once', {})
      originalJobId = job.id
      expect(await withTimeout(acquired, 'child acquisition')).toBe(originalJobId)

      const exitPromise = waitForChildExit(stalledChild!)
      expect(stalledChild!.kill('SIGKILL')).toBe(true)
      childExit = await exitPromise
      expect(childExit.signalCode).toBe('SIGKILL')

      recoveryConnection = new IORedis(process.env.REDIS_URL!, workerOptions)
      let resolveWorkerStalled: (jobId: string) => void
      const workerStalled = new Promise<string>((resolve) => { resolveWorkerStalled = resolve })
      recoveryWorker = new Worker(QUEUE_NAMES.AUTOMATION, async () => 'recovered', {
        connection: recoveryConnection,
        lockDuration: 500,
        stalledInterval: 500,
        maxStalledCount: 1,
      })
      recoveryWorker.on('stalled', (jobId) => {
        workerStalledJobId = jobId
        resolveWorkerStalled(jobId)
      })
      workerCompleted = new Promise<string>((resolve) => {
        recoveryWorker!.on('completed', (job) => {
          completedJobId = job.id
          resolve(job.id!)
        })
      })

      expect(await withTimeout(workerStalled, 'recovery Worker stalled event')).toBe(originalJobId)
      const status = await eventually(() => stalledQueues.getQueueStatus(), (snapshot) =>
        snapshot.ok === true && (snapshot.stalledEvents?.automation?.count ?? 0) >= 1, 30_000)
      expect(status.stalledEvents.automation.lastStalledAt).toBeDefined()
      expect(stalledMetrics.snapshot().counters['queue.job.stalled.automation']).toBeGreaterThanOrEqual(1)
      expect(stalledMetrics.snapshot().gauges).not.toHaveProperty('queue.backlog.stalled.automation')
      expect(await withTimeout(workerCompleted, 'recovery Worker completed event')).toBe(originalJobId)
      await eventually(() => queue.getJob(originalJobId!), (completedJob) => completedJob === undefined, 30_000)
    } catch (error) {
      const job = originalJobId ? await queue.getJob(originalJobId).catch(() => undefined) : undefined
      const diagnostic = {
        counts: await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed').catch(String),
        jobState: await job?.getState().catch(String),
        stalledEvents: await stalledQueues.getQueueStatus().then((status) => status.stalledEvents).catch(String),
        counters: stalledMetrics.snapshot().counters,
        workerStalledObserved: workerStalledJobId,
        completedJobId,
        childExitCode: childExit?.exitCode ?? stalledChild?.exitCode,
        childSignalCode: childExit?.signalCode ?? stalledChild?.signalCode,
      }
      throw new Error(`${error instanceof Error ? error.message : String(error)}; stalled diagnostic=${JSON.stringify(diagnostic)}`)
    } finally {
      if (stalledChild && stalledChild.exitCode === null && stalledChild.signalCode === null) stalledChild.kill('SIGKILL')
      if (stalledChild) await waitForChildExit(stalledChild).catch(() => undefined)
      await recoveryWorker?.close(true).catch(() => undefined)
      if (recoveryConnection?.status !== 'end') await recoveryConnection?.quit().catch(() => recoveryConnection?.disconnect())
      await queue.obliterate({ force: true }).catch(() => undefined)
      await stalledQueues.onModuleDestroy()
      for (const connection of stalledAuxiliaryConnections) {
        if (connection.status !== 'end') await connection.quit().catch(() => connection.disconnect())
      }
    }
  })
})
