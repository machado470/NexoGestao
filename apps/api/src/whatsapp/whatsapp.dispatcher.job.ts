// apps/api/src/whatsapp/whatsapp.dispatcher.job.ts

import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { WhatsAppService } from './whatsapp.service'
import { isWhatsAppSendError } from './providers/whatsapp.provider'
import { createWhatsAppProvider } from './providers/provider.factory'

@Injectable()
export class WhatsAppDispatcherJob {
  private readonly logger = new Logger(WhatsAppDispatcherJob.name)
  private readonly provider = createWhatsAppProvider()

  constructor(private readonly whatsApp: WhatsAppService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async dispatchQueued() {
    if (process.env.DISABLE_WHATSAPP_SCHEDULE === '1') return

    const workerId = `api-${process.pid}`

    try {
      const claimed = await this.whatsApp.claimQueued({ limit: 50, workerId })
      if (claimed.length === 0) return

      this.logger.log(
        `dispatching ${claimed.length} whatsapp message(s) worker=${workerId}`,
      )

      for (const message of claimed) {
        try {
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
            continue
          }

          await this.whatsApp.markFailed({
            id: message.id,
            provider: result.provider,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          })
        } catch (error: any) {
          await this.whatsApp.markFailed({
            id: message.id,
            provider: 'internal',
            errorCode: 'UNEXPECTED',
            errorMessage: error?.message ?? 'unexpected error',
          })
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `dispatchQueued failed worker=${workerId} err=${error?.code ?? ''} msg=${error?.message ?? error}`,
      )
    }
  }
}
