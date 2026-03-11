import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'

import { AppointmentsService } from './appointments.service'
import { AppointmentsController } from './appointments.controller'

import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { WhatsAppModule } from '../whatsapp/whatsapp.module'
import { RiskModule } from '../risk/risk.module'
import { AutomationModule } from '../automation/automation.module'
import { QuotasModule } from '../quotas/quotas.module'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    WhatsAppModule,
    RiskModule,
    AutomationModule,
    QuotasModule,
  ],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
