import { Module } from '@nestjs/common'
import { AutomationService } from './automation.service'
import { AutomationController } from './automation.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { RiskModule } from '../risk/risk.module'
import { WhatsAppModule } from '../whatsapp/whatsapp.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [PrismaModule, NotificationsModule, RiskModule, WhatsAppModule, AuthModule],
  providers: [AutomationService],
  controllers: [AutomationController],
  exports: [AutomationService],
})
export class AutomationModule {}
