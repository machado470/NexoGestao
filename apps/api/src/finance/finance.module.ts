import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { OperationalStateModule } from '../people/operational-state.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { WhatsAppModule } from '../whatsapp/whatsapp.module'
import { RiskModule } from '../risk/risk.module'
import { OnboardingModule } from '../onboarding/onboarding.module'

import { FinanceController } from './finance.controller'
import { FinanceService } from './finance.service'

@Module({
  imports: [PrismaModule, TimelineModule, AuditModule, OperationalStateModule, NotificationsModule, WhatsAppModule, RiskModule, OnboardingModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
