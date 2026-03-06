import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { createHmac } from 'crypto'
import { QUEUE_CONNECTION, QUEUE_NAMES } from '../queue.constants'
import { QueueService } from '../queue.service'
import { WebhookService } from '../../webhooks/webhook.service'

@Injectable()
export class WebhookProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookProcessor.name)
  private worker?: Worker

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: IORedis,
    private readonly queueService: QueueService,
    private readonly webhookService: WebhookService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.WEBHOOKS,
      async (job: Job<any>) => {
        await this.queueService.updateJobStatus({
          queue: QUEUE_NAMES.WEBHOOKS,
          jobId: job.id?.toString() ?? '',
          status: 'ACTIVE',
        })

        if (job.name !== 'dispatch-webhook') return

        const delivery = await this.webhookService.getDeliveryContext(job.data.deliveryId)
        if (!delivery || !delivery.endpoint?.active) return

        const payloadText = JSON.stringify(delivery.payload)
        const signature = createHmac('sha256', delivery.endpoint.secret).update(payloadText).digest('hex')

        const response = await fetch(delivery.endpoint.url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-nexo-signature': signature,
          },
          body: payloadText,
        })

        const isSuccess = response.ok
        await this.webhookService.markDeliveryAttempt({
          deliveryId: delivery.id,
          attempts: Number(job.attemptsMade ?? 0) + 1,
          status: isSuccess ? 'SUCCESS' : 'FAILED',
        })

        if (!isSuccess) {
          throw new Error(`Webhook HTTP error status=${response.status}`)
        }

        await this.queueService.updateJobStatus({
          queue: QUEUE_NAMES.WEBHOOKS,
          jobId: job.id?.toString() ?? '',
          status: 'COMPLETED',
          completed: true,
        })
      },
      { connection: this.connection },
    )

    this.worker.on('failed', async (job, err) => {
      if (!job) return
      this.logger.error(`webhook job failed id=${job.id} error=${err.message}`)

      await this.queueService.updateJobStatus({
        queue: QUEUE_NAMES.WEBHOOKS,
        jobId: job.id?.toString() ?? '',
        status: 'FAILED',
        error: err.message,
      })
    })
  }

  async onModuleDestroy() {
    await this.worker?.close()
  }
}
