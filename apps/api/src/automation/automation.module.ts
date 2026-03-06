import { Module } from '@nestjs/common'
import { AutomationService } from './automation.service'
import { AutomationController } from './automation.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { RiskModule } from '../risk/risk.module'
import { WhatsAppModule } from '../whatsapp/whatsapp.module'
import { AuthModule } from '../auth/auth.module'
import { QueueModule } from '../queue/queue.module'
import { AutomationProcessor } from '../queue/processors/automation.processor'

@Module({
  imports: [PrismaModule, NotificationsModule, RiskModule, WhatsAppModule, AuthModule, QueueModule],
  providers: [AutomationService, AutomationProcessor],
  controllers: [AutomationController],
  exports: [AutomationService],
})
export class AutomationModule {}
