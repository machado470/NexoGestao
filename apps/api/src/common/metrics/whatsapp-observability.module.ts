import { Module } from '@nestjs/common'
import { WhatsAppObservabilityService } from './whatsapp-observability.service'

@Module({
  providers: [WhatsAppObservabilityService],
  exports: [WhatsAppObservabilityService],
})
export class WhatsAppObservabilityModule {}
