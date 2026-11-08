import { Module } from '@nestjs/common'
import { WhatsAppObservabilityService } from './whatsapp-observability.service'

/** Shared metrics must not depend on the health endpoints or business modules. */
@Module({
  providers: [WhatsAppObservabilityService],
  exports: [WhatsAppObservabilityService],
})
export class WhatsAppMetricsModule {}
