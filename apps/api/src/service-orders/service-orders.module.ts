import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'

import { ServiceOrdersService } from './service-orders.service'
import { ServiceOrdersController } from './service-orders.controller'

import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { PeopleModule } from '../people/people.module'
import { FinanceModule } from '../finance/finance.module'
import { AutomationModule } from '../automation/automation.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { OnboardingModule } from '../onboarding/onboarding.module'
import { QuotasModule } from '../quotas/quotas.module'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    PeopleModule,
    FinanceModule,
    AutomationModule,
    NotificationsModule,
    OnboardingModule,
    QuotasModule,
  ],
  providers: [ServiceOrdersService],
  controllers: [ServiceOrdersController],
  exports: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
