import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { QueueModule } from '../queue/queue.module'
import { InternalStatsController } from './internal-stats.controller'
import { WhatsAppObservabilityService } from '../common/metrics/whatsapp-observability.service'

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [HealthController, InternalStatsController],
  providers: [WhatsAppObservabilityService],
  exports: [WhatsAppObservabilityService],
})
export class HealthModule {}
