import { PrismaClient } from '@prisma/client'
import { Queue, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'
import { randomUUID } from 'crypto'
import { TenantOperationsService } from '../../src/common/tenant-ops/tenant-ops.service'
import { WhatsAppProcessor } from '../../src/queue/processors/whatsapp.processor'
import { QUEUE_NAMES, WHATSAPP_QUEUE_JOB_NAMES } from '../../src/queue/queue.constants'
import { CustomersOperationalSummaryService } from '../../src/customers/customers-operational-summary.service'

// Explicit opt-in: use a dedicated Redis database, with no application workers.
const suite = process.env.RUN_CAPACITY_COMBINED_INTEGRATION === 'true' ? describe : describe.skip
suite('Capacity / multiple tenants / real PostgreSQL and Redis', () => {
  const db = new PrismaClient()
  const orgIds = [randomUUID(), randomUUID(), randomUUID()]
  const customerIds = orgIds.map(() => randomUUID())
  beforeAll(async () => {
    await db.$connect()
    for (const [i, orgId] of orgIds.entries()) {
      await db.organization.create({ data: { id: orgId, name: `Capacity synthetic ${i}`, slug: orgId } })
      await db.customer.create({ data: { id: customerIds[i], orgId, name: `Synthetic customer ${i}`, phone: '11900000000' } })
    }
  })
  afterAll(async () => {
    await db.whatsAppMessage.deleteMany({ where: { orgId: { in: orgIds } } })
    await db.whatsAppConversation.deleteMany({ where: { orgId: { in: orgIds } } })
    await db.tenantRateLimitBucket.deleteMany({ where: { orgId: { in: orgIds } } })
    await db.customer.deleteMany({ where: { orgId: { in: orgIds } } })
    await db.organization.deleteMany({ where: { id: { in: orgIds } } })
    await db.$disconnect()
  })

  it('bounds history reads and preserves tenant isolation beyond ten thousand messages', async () => {
    for (let offset = 0; offset < 10001; offset += 500) {
      await db.whatsAppMessage.createMany({ data: Array.from({ length: Math.min(500, 10001 - offset) }, () => ({
        orgId: orgIds[0], customerId: customerIds[0], entityType: 'GENERAL' as const,
        entityId: customerIds[0], messageType: 'MANUAL' as const, direction: 'OUTBOUND' as const,
        status: 'FAILED' as const, toPhone: '11900000000', renderedText: 'Synthetic capacity failure',
      })) })
    }
    const now = new Date()
    await db.whatsAppConversation.createMany({ data: [
      {orgId:orgIds[0],customerId:customerIds[0],phone:'11900000001',status:'WAITING_OPERATOR' as const,responseDueAt:new Date(now.getTime()-1)},
      {orgId:orgIds[0],customerId:customerIds[0],phone:'11900000002',status:'WAITING_OPERATOR' as const,responseDueAt:now},
      {orgId:orgIds[0],customerId:customerIds[0],phone:'11900000003',status:'WAITING_OPERATOR' as const,responseDueAt:null},
      {orgId:orgIds[0],customerId:customerIds[0],phone:'11900000004',status:'OPEN' as const,responseDueAt:new Date(now.getTime()-1)},
    ] })
    const calls: Array<{ orgId: string; rows: number }> = []
    // Observe real query arguments/results without changing their execution.
    const observed = Object.create(db)
    Object.defineProperty(observed, 'whatsAppMessage', { value: {
      groupBy: async (args: any) => {
        const rows = await db.whatsAppMessage.groupBy({
          by: ['customerId'], where: args.where, _count: { _all: true },
        })
        calls.push({ orgId: args.where.orgId, rows: rows.length })
        return rows
      },
    } })
    const service = new CustomersOperationalSummaryService(observed)
    const startedAt = Date.now()
    const results = await Promise.all(orgIds.map(orgId => service.getSummaryPage(orgId, customerIds, now)))
    expect(results.map(result => result.portfolio.totalCustomers)).toEqual([1, 1, 1])
    for (const [i, result] of results.entries()) {
      expect(result.customers.map(customer => customer.customerId)).toEqual([customerIds[i]])
    }
    expect(results[0].customers[0].breakdown.find(factor => factor.code === 'MESSAGE_FAILURES')?.value).toBe(10001)
    expect(results[1].customers[0].breakdown.some(factor => factor.code === 'MESSAGE_FAILURES')).toBe(false)
    expect(results[0].customers[0].factors.awaitingResponseConversations).toBe(1)
    expect(calls.filter(call => call.orgId === orgIds[0])).toHaveLength(1)
    expect(calls.every(call => call.rows <= 1)).toBe(true)
    console.log(JSON.stringify({ evidence: 'history-multitenant', organizations: 3, messages: 10001, returnedMessageGroups: 1, historyQueries: 1, durationMs: Date.now() - startedAt, isolationVerified: true }))
  }, 60000)

  it('shares real budgets across two workers and drains a noisy tenant without starving peers', async () => {
    const url = new URL(process.env.CAPACITY_TEST_REDIS_URL!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/15') {
      throw new Error('This test requires isolated loopback Redis database 15')
    }
    const connection = new IORedis(url.toString(), { maxRetriesPerRequest: null })
    const queue = new Queue(QUEUE_NAMES.WHATSAPP_INBOUND, { connection })
    const events = new QueueEvents(QUEUE_NAMES.WHATSAPP_INBOUND, { connection })
    const seen: Array<{ orgId: string; at: number }> = []
    const allowed: Array<{ orgId: string; at: number }> = []
    let denied = 0
    const domain = { processPersistedInboundWebhook: async ({ orgId }: { orgId: string }) => { seen.push({ orgId, at: Date.now() }); return { processed: 1 } } }
    const queues = { updateJobStatus: async () => {}, processJobWithTracing: (_queue: any, _name: any, _data: any, run: () => any) => run() }
    const metrics: any = { incInboundWebhookStarted: () => {}, incInboundWebhookCompleted: () => {}, observeProcessingDuration: () => {} }
    const processors = [0, 1].map(() => {
      const budget = new TenantOperationsService(db as any)
      const observed = { enforceLimit: async (input: Parameters<TenantOperationsService['enforceLimit']>[0]) => {
        const result = await budget.enforceLimit(input)
        if (result.allowed) allowed.push({ orgId: input.orgId, at: Date.now() }); else denied++
        return result
      } }
      return new WhatsAppProcessor(connection, domain as any, queues as any, metrics, { observeDuration: () => {} } as any, observed as any)
    })
    const jobs: any[] = []
    let started = false
    try {
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'paused')
      expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(0)
      expect(await queue.isPaused()).toBe(false)
      await events.waitUntilReady()
      // Enqueue noisy tenant first, ahead of both quieter tenants.
      for (const [i, orgId] of orgIds.entries()) {
        for (let j = 0; j < (i === 0 ? 31 : 5); j++) jobs.push(await queue.add(WHATSAPP_QUEUE_JOB_NAMES.INBOUND_WEBHOOK,
          { orgId, webhookEventId: randomUUID(), provider: 'mock', traceId: randomUUID() }, { jobId: randomUUID() }))
      }
      const began = Date.now()
      started = true
      await Promise.all(processors.map(processor => processor.onModuleInit()))
      await Promise.all(jobs.map(job => job.waitUntilFinished(events, 20000)))
      expect(seen).toHaveLength(41)
      expect(allowed).toHaveLength(41)
      expect(denied).toBeGreaterThan(0)
      expect(orgIds.map(orgId => seen.filter(item => item.orgId === orgId).length)).toEqual([31, 5, 5])
      const noisyEnd = seen.map(item => item.orgId).lastIndexOf(orgIds[0])
      for (const orgId of orgIds.slice(1)) expect(seen.findIndex(item => item.orgId === orgId)).toBeLessThan(noisyEnd)
      for (const job of jobs) expect((await queue.getJob(job.id))?.attemptsMade).toBe(1)
      console.log(JSON.stringify({ evidence: 'queue-multitenant', organizations: 3, workerReplicas: 2, jobs: 41, completed: seen.length, deferredAttempts: denied, durationMs: Date.now() - began, peerProgressBeforeNoisyCompletion: true }))
    } finally {
      if (started) await Promise.all(processors.map(processor => processor.onModuleDestroy()))
      for (const job of jobs) await job.remove().catch(() => {})
      await events.close(); await queue.close(); await connection.quit()
    }
  }, 30000)
})
