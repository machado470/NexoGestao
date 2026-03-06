import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { OperationalStateModule } from '../people/operational-state.module'
import { FinanceModule } from '../finance/finance.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { QuotasModule } from '../quotas/quotas.module'
import { OnboardingModule } from '../onboarding/onboarding.module'
import { AutomationModule } from '../automation/automation.module'

import { ServiceOrdersController } from './service-orders.controller'
import { ServiceOrdersService } from './service-orders.service'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    OperationalStateModule,
    FinanceModule,
    NotificationsModule,
    QuotasModule,
    OnboardingModule,
    AutomationModule,
  ],
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
