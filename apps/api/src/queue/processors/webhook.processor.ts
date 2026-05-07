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

  async onModuleInit() {
    if (!(await this.queueService.ensureEnabled())) {
      this.logger.warn('Webhook worker não iniciado: Redis/fila em modo degradado')
      return
    }

    try {
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
          const signature = createHmac('sha256', delivery.endpoint.secret)
            .update(payloadText)
            .digest('hex')

          const response = await fetch(delivery.endpoint.url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-nexo-signature': signature,
            },
            body: payloadText,
          })

          if (!response.ok) {
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

      this.worker.on('error', (error) => {
        this.logger.error(`Webhook worker error: ${error.message}`)
      })

      this.logger.log('Webhook worker iniciado')
    } catch (err) {
      const error = err as Error
      this.logger.error(`Falha ao iniciar webhook worker: ${error.message}`)
    }
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close()
    } catch (err) {
      const error = err as Error
      this.logger.error(`Erro ao fechar webhook worker: ${error.message}`)
    }
  }
}
