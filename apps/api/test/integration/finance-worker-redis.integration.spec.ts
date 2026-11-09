import { Queue, QueueEvents, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { randomUUID } from 'node:crypto'
import { FinanceProcessor } from '../../src/queue/processors/finance.processor'
import { FinanceService } from '../../src/finance/finance.service'
import { describeRealIntegration } from './infra-guards'

describeRealIntegration('Financial worker outcomes in an isolated Redis queue', () => {
  jest.setTimeout(30000)
  const queueName = `finance-audit-${randomUUID()}`
  let connection: IORedis, eventConnection: IORedis, queue: Queue, events: QueueEvents, worker: Worker
  const findFirst = jest.fn(), enqueueMessage = jest.fn()
  const finance = new FinanceService({ charge: { findFirst } } as any, { enqueueMessage } as any,
    {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any)
  const processor = new FinanceProcessor({} as any, finance, { updateJobStatus: async () => {} } as any)
  beforeAll(async () => {
    connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null })
    eventConnection = connection.duplicate()
    queue = new Queue(queueName, { connection })
    events = new QueueEvents(queueName, { connection: eventConnection })
    worker = new Worker(queueName, job => processor.processJob(job), { connection })
    await Promise.all([queue.waitUntilReady(), events.waitUntilReady(), worker.waitUntilReady()])
  })
  beforeEach(() => {
    findFirst.mockReset().mockImplementation(async ({ where }: any) => where.orgId === 'org' && where.id === 'charge' ? {
      id: 'charge', orgId: 'org', org: { timezone: 'America/Sao_Paulo' }, status: 'PENDING', amountCents: 1000, dueDate: new Date(), customerId: 'customer', customer: { name: 'Customer', phone: '5511999999999' },
    } : null)
    enqueueMessage.mockReset().mockResolvedValue({ created: true, message: { id: 'message' } })
  })
  afterAll(async () => {
    await worker?.close()
    await events?.close()
    await queue?.obliterate({ force: true })
    await queue?.close()
    if (eventConnection && eventConnection.status !== 'end') await eventConnection.quit()
    if (connection && connection.status !== 'end') await connection.quit()
  })
  const add = (name: string, data: object = {}) => queue.add(name, data, { attempts: 1, removeOnComplete: false, removeOnFail: false })
  it.each(['create-charge', 'unknown'])('marks unsupported %s as failed, never completed', async name => {
    const job = await add(name)
    await expect(job.waitUntilFinished(events, 10000)).rejects.toThrow()
    expect(await job.getState()).toBe('failed')
    expect(enqueueMessage).not.toHaveBeenCalled()
  })
  it('completes a reminder with a confirmed queued result and one send', async () => {
    const job = await add('payment-reminder', { orgId: 'org', chargeId: 'charge' })
    expect(await job.waitUntilFinished(events, 10000)).toEqual({ status: 'queued', messageId: 'message' })
    expect(await job.getState()).toBe('completed')
    expect(enqueueMessage).toHaveBeenCalledTimes(1)
  })
  it('fails a cross-tenant reminder without sending', async () => {
    const job = await add('payment-reminder', { orgId: 'foreign', chargeId: 'charge' })
    await expect(job.waitUntilFinished(events, 10000)).rejects.toThrow('nesta organização')
    expect(await job.getState()).toBe('failed')
    expect(enqueueMessage).not.toHaveBeenCalled()
  })
  it('reports an obsolete canceled reminder as skipped', async () => {
    findFirst.mockResolvedValue({ status: 'CANCELED' })
    const job = await add('payment-reminder', { orgId: 'org', chargeId: 'charge' })
    expect(await job.waitUntilFinished(events, 10000)).toEqual({ status: 'skipped', reason: 'charge_closed' })
    expect(enqueueMessage).not.toHaveBeenCalled()
  })
  it('fails if queue admission cannot be confirmed', async () => {
    enqueueMessage.mockResolvedValue({})
    const job = await add('payment-reminder', { orgId: 'org', chargeId: 'charge' })
    await expect(job.waitUntilFinished(events, 10000)).rejects.toThrow('confirmar o enfileiramento')
    expect(await job.getState()).toBe('failed')
  })
})
