import { WebhookProcessor } from './webhook.processor'
import { QUEUE_NAMES, WEBHOOK_QUEUE_JOB_NAMES } from '../queue.constants'

describe('WebhookProcessor DLQ hardening', () => {
  it('envia para DLQ quando retries esgotam e marca delivery FAILED', async () => {
    const queueService = {
      ensureEnabled: jest.fn(),
      updateJobStatus: jest.fn(),
      addJob: jest.fn().mockResolvedValue({ id: 'dlq-job-1' }),
    } as any
    const webhookService = {
      getDeliveryContext: jest.fn().mockResolvedValue({ id: 'd1', endpointId: 'w1', endpoint: { orgId: 'org1' } }),
      markDeliveryAttempt: jest.fn().mockResolvedValue({}),
    } as any

    const processor = new WebhookProcessor({} as any, queueService, webhookService)
    const job = { id: 'job-1', attemptsMade: 5, opts: { attempts: 5 }, data: { deliveryId: 'd1' } } as any

    await processor.handleFailedJob(job, new Error('timeout'))

    expect(webhookService.markDeliveryAttempt).toHaveBeenCalledWith({ deliveryId: 'd1', attempts: 5, status: 'FAILED' })
    expect(queueService.addJob).toHaveBeenCalledWith(
      QUEUE_NAMES.WEBHOOKS_DLQ,
      WEBHOOK_QUEUE_JOB_NAMES.DISPATCH_DLQ,
      expect.objectContaining({ deliveryId: 'd1', orgId: 'org1', webhookId: 'w1', attemptsMade: 5 }),
      { jobId: 'webhook:dispatch:dlq:d1' },
    )
  })
})
