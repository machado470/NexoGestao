import { WhatsAppProcessor } from './whatsapp.processor'
import { QUEUE_NAMES, WHATSAPP_QUEUE_JOB_NAMES } from '../queue.constants'

jest.mock('../../whatsapp/providers/provider.factory', () => ({
  createWhatsAppProvider: () => ({
    sendText: jest.fn(),
  }),
}))

describe('WhatsAppProcessor inbound webhook jobs', () => {
  function makeProcessor(overrides: Partial<any> = {}) {
    const whatsApp = {
      processPersistedInboundWebhook: jest.fn().mockResolvedValue({ processed: 1 }),
      recordWebhookEventAttempt: jest.fn().mockResolvedValue({}),
      deadLetterWebhookEvent: jest.fn().mockResolvedValue({}),
      ...overrides.whatsApp,
    }
    const queueService = {
      updateJobStatus: jest.fn().mockResolvedValue({}),
      addJob: jest.fn().mockResolvedValue({ id: 'dlq1' }),
    }
    const metrics = {
      incInboundWebhookStarted: jest.fn(),
      incInboundWebhookCompleted: jest.fn(),
      incInboundWebhookFailed: jest.fn(),
      incInboundWebhookDeadLettered: jest.fn(),
      incFailedJobs: jest.fn(),
      incRetry: jest.fn(),
      observeProcessingDuration: jest.fn(),
    }
    const processor = new WhatsAppProcessor({} as any, whatsApp as any, queueService as any, metrics as any)
    return { processor, whatsApp, queueService, metrics }
  }

  it('worker processa webhook persistido pelo webhookEventId', async () => {
    const { processor, whatsApp, queueService, metrics } = makeProcessor()
    const job = {
      id: 'job1',
      name: WHATSAPP_QUEUE_JOB_NAMES.INBOUND_WEBHOOK,
      attemptsMade: 0,
      data: { webhookEventId: 'wh1', orgId: 'org1', provider: 'meta_cloud', traceId: 'trace-1', receivedAt: '2026-05-06T00:00:00.000Z' },
    }

    await processor.process(job as any)

    expect(whatsApp.processPersistedInboundWebhook).toHaveBeenCalledWith(expect.objectContaining({ webhookEventId: 'wh1', orgId: 'org1', provider: 'meta_cloud', traceId: 'trace-1' }))
    expect(queueService.updateJobStatus).toHaveBeenCalledWith(expect.objectContaining({ queue: QUEUE_NAMES.WHATSAPP, jobId: 'job1', status: 'COMPLETED', completed: true }))
    expect(metrics.incInboundWebhookStarted).toHaveBeenCalled()
    expect(metrics.incInboundWebhookCompleted).toHaveBeenCalled()
  })

  it('falha de worker registra tentativa para retry seguro', async () => {
    const { processor, whatsApp, metrics } = makeProcessor({ whatsApp: { processPersistedInboundWebhook: jest.fn().mockRejectedValue(new Error('transient')) } })
    const job = {
      id: 'job1',
      name: WHATSAPP_QUEUE_JOB_NAMES.INBOUND_WEBHOOK,
      attemptsMade: 1,
      data: { webhookEventId: 'wh1', orgId: 'org1', provider: 'meta_cloud', traceId: 'trace-1' },
    }

    await expect(processor.process(job as any)).rejects.toThrow('transient')

    expect(whatsApp.recordWebhookEventAttempt).toHaveBeenCalledWith('wh1', 'transient')
    expect(metrics.incInboundWebhookFailed).toHaveBeenCalled()
  })

  it('dead-letter do worker marca webhook como FAILED e envia para DLQ', async () => {
    const { processor, whatsApp, queueService, metrics } = makeProcessor()
    const job = {
      id: 'job1',
      name: WHATSAPP_QUEUE_JOB_NAMES.INBOUND_WEBHOOK,
      attemptsMade: 5,
      opts: { attempts: 5 },
      data: { webhookEventId: 'wh1', orgId: 'org1', provider: 'meta_cloud', traceId: 'trace-1' },
    }

    await processor.handleFailedJob(job as any, new Error('terminal'))

    expect(whatsApp.deadLetterWebhookEvent).toHaveBeenCalledWith({ id: 'wh1', orgId: 'org1', errorMessage: 'terminal', attemptsMade: 5 })
    expect(metrics.incInboundWebhookDeadLettered).toHaveBeenCalled()
    expect(queueService.addJob).toHaveBeenCalledWith(
      QUEUE_NAMES.WHATSAPP_DLQ,
      WHATSAPP_QUEUE_JOB_NAMES.INBOUND_WEBHOOK_DLQ,
      expect.objectContaining({ webhookEventId: 'wh1', error: 'terminal', attemptsMade: 5 }),
    )
  })

})
