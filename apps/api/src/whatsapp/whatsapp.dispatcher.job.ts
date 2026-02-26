// apps/api/src/whatsapp/whatsapp.dispatcher.job.ts

import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { WhatsAppService } from './whatsapp.service'
import { MockWhatsAppProvider } from './providers/mock.provider'

@Injectable()
export class WhatsAppDispatcherJob {
  private readonly logger = new Logger(WhatsAppDispatcherJob.name)
  private readonly provider = new MockWhatsAppProvider()

  constructor(private readonly whatsApp: WhatsAppService) {}

  // roda a cada 10 segundos (dev-friendly)
  @Cron(CronExpression.EVERY_10_SECONDS)
  async dispatchQueued() {
    const workerId = `api-${process.pid}`

    const claimed = await this.whatsApp.claimQueued({ limit: 50, workerId })
    if (claimed.length === 0) return

    this.logger.log(`dispatching ${claimed.length} claimed whatsapp message(s) worker=${workerId}`)

    for (const m of claimed) {
      try {
        const res = await this.provider.send({
          toPhone: m.toPhone,
          text: m.renderedText,
        })

        if (res.ok) {
          await this.whatsApp.markSent({
            id: m.id,
            provider: res.provider,
            providerMessageId: res.providerMessageId,
          })
        } else {
          await this.whatsApp.markFailed({
            id: m.id,
            provider: res.provider,
            errorCode: res.errorCode,
            errorMessage: res.errorMessage,
          })
        }
      } catch (err: any) {
        await this.whatsApp.markFailed({
          id: m.id,
          provider: 'internal',
          errorCode: 'UNEXPECTED',
          errorMessage: err?.message ?? 'unexpected error',
        })
      }
    }
  }
}
