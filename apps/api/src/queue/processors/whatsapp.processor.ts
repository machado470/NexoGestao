import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { WhatsAppService } from '../../whatsapp/whatsapp.service'
import { MockWhatsAppProvider } from '../../whatsapp/providers/mock.provider'
import { QUEUE_CONNECTION, QUEUE_NAMES } from '../queue.constants'
import { QueueService } from '../queue.service'

@Injectable()
export class WhatsAppProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppProcessor.name)
  private readonly provider = new MockWhatsAppProvider()
  private worker?: Worker

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: IORedis,
    private readonly whatsApp: WhatsAppService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.WHATSAPP,
      async (job: Job<any>) => {
        await this.queueService.updateJobStatus({
          queue: QUEUE_NAMES.WHATSAPP,
          jobId: job.id?.toString() ?? '',
          status: 'ACTIVE',
        })

        const message = await this.whatsApp.findById(job.data.messageId)
        if (!message) return

        const result = await this.provider.send({ toPhone: message.toPhone, text: message.renderedText })

        if (result.ok) {
          await this.whatsApp.markSent({
            id: message.id,
            provider: result.provider,
            providerMessageId: result.providerMessageId,
          })
        } else {
          const error = result as any
          await this.whatsApp.markFailed({
            id: message.id,
            provider: error.provider,
            errorCode: error.errorCode,
            errorMessage: error.errorMessage,
          })
          throw new Error(error.errorMessage)
        }

        await this.queueService.updateJobStatus({
          queue: QUEUE_NAMES.WHATSAPP,
          jobId: job.id?.toString() ?? '',
          status: 'COMPLETED',
          completed: true,
        })
      },
      { connection: this.connection },
    )

    this.worker.on('failed', async (job, err) => {
      if (!job) return
      this.logger.error(`whatsapp job failed id=${job.id} error=${err.message}`)
      await this.queueService.updateJobStatus({
        queue: QUEUE_NAMES.WHATSAPP,
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
