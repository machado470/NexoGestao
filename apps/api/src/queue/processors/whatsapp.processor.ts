import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { WhatsAppService } from '../../whatsapp/whatsapp.service'
import { isWhatsAppSendError } from '../../whatsapp/providers/whatsapp.provider'
import { createWhatsAppProvider } from '../../whatsapp/providers/provider.factory'
import { QUEUE_CONNECTION, QUEUE_NAMES } from '../queue.constants'
import { QueueService } from '../queue.service'

@Injectable()
export class WhatsAppProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppProcessor.name)
  private readonly provider = createWhatsAppProvider()
  private worker?: Worker

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: IORedis,
    private readonly whatsApp: WhatsAppService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit() {
    try {
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

          const result = await this.provider.send({
            toPhone: message.toPhone,
            text: message.renderedText,
          })

          if (!isWhatsAppSendError(result)) {
            await this.whatsApp.markSent({
              id: message.id,
              provider: result.provider,
              providerMessageId: result.providerMessageId,
            })

            await this.queueService.updateJobStatus({
              queue: QUEUE_NAMES.WHATSAPP,
              jobId: job.id?.toString() ?? '',
              status: 'COMPLETED',
              completed: true,
            })

            return
          }

          await this.whatsApp.markFailedAndRequeue({
            id: message.id,
            provider: result.provider,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          })

          throw new Error(result.errorMessage)
        },
        { connection: this.connection },
      )

      this.logger.log('WhatsApp worker iniciado')
    } catch (error) {
      const err = error as Error
      this.logger.error(`Falha ao iniciar whatsapp worker: ${err.message}`)
    }
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close()
    } catch (error) {
      const err = error as Error
      this.logger.error(`Erro ao fechar whatsapp worker: ${err.message}`)
    }
  }
}
