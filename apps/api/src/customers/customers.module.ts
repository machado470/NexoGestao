import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { QuotasModule } from '../quotas/quotas.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { AnalyticsModule } from '../analytics/analytics.module'
import { OnboardingModule } from '../onboarding/onboarding.module'

import { CustomersController } from './customers.controller'
import { CustomersService } from './customers.service'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    QuotasModule,
    NotificationsModule,
    AnalyticsModule,
    OnboardingModule,
  ],
  controllers: [
    CustomersController,
  ],
  providers: [
    CustomersService,
  ],
})
export class CustomersModule {}
