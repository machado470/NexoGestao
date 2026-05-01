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
import {
  isFatalWhatsAppSendError,
  isWhatsAppSendError,
} from '../../whatsapp/providers/whatsapp.provider'
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
          const requestId = job.data?.requestId ?? 'n/a'
          const userId = job.data?.userId ?? 'n/a'
          const orgId = job.data?.orgId ?? 'n/a'

          await this.queueService.updateJobStatus({
            queue: QUEUE_NAMES.WHATSAPP,
            jobId: job.id?.toString() ?? '',
            status: 'ACTIVE',
          })

          const message = await this.whatsApp.findById(job.data.messageId)
          if (!message) return

          const result = await this.provider.sendText({
            toPhone: message.toPhone,
            text: message.content ?? message.renderedText,
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

          if (isFatalWhatsAppSendError(result)) {
            await this.whatsApp.markFailedTerminal({
              id: message.id,
              provider: result.provider,
              errorCode: result.errorCode,
              errorMessage: result.errorMessage,
            })

            await this.queueService.updateJobStatus({
              queue: QUEUE_NAMES.WHATSAPP,
              jobId: job.id?.toString() ?? '',
              status: 'COMPLETED',
              completed: true,
            })

            await this.queueService.addJob(
              QUEUE_NAMES.WHATSAPP_DLQ,
              'whatsapp.send.dlq',
              {
                payload: job.data,
                error: result.errorMessage,
                attemptsMade: job.attemptsMade,
                requestId,
                userId,
                orgId,
              },
            )

            throw new Error(`UNRECOVERABLE_WHATSAPP_ERROR:${result.errorCode}`)
          }

          await this.whatsApp.markFailedAndRequeue({
            id: message.id,
            provider: result.provider,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          })

          throw new Error(result.errorMessage)
        },
        {
          connection: this.connection,
          concurrency: 5,
          limiter: { max: 10, duration: 1000 },
        },
      )

      this.worker.on('failed', async (job, err) => {
        const nextAttempt = (job?.attemptsMade ?? 0) + 1
        const baseDelay = 1000
        const retryDelayMs = baseDelay * 2 ** Math.max(0, nextAttempt - 1)
        this.logger.warn(
          `whatsapp job retry jobId=${job?.id?.toString() ?? ''} attempt=${nextAttempt} delayMs=${retryDelayMs} requestId=${job?.data?.requestId ?? 'n/a'} userId=${job?.data?.userId ?? 'n/a'} orgId=${job?.data?.orgId ?? 'n/a'} error=${err.message}`,
        )

        if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
          await this.queueService.addJob(
            QUEUE_NAMES.WHATSAPP_DLQ,
            'whatsapp.send.dlq',
            {
              payload: job.data,
              error: err.message,
              attemptsMade: job.attemptsMade,
              requestId: job.data?.requestId,
              userId: job.data?.userId,
              orgId: job.data?.orgId,
            },
          )
        }
      })

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
