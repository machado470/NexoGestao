import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { QuotasModule } from '../quotas/quotas.module'
import { WhatsAppModule } from '../whatsapp/whatsapp.module'
import { RiskModule } from '../risk/risk.module'
import { AutomationModule } from '../automation/automation.module'

import { AppointmentsController } from './appointments.controller'
import { AppointmentsService } from './appointments.service'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    QuotasModule,
    WhatsAppModule,
    RiskModule,
    AutomationModule,
  ],
  controllers: [
    AppointmentsController,
  ],
  providers: [
    AppointmentsService,
  ],
})
export class AppointmentsModule {}
