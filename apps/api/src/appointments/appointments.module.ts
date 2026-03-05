import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { QuotasModule } from '../quotas/quotas.module'

import { AppointmentsController } from './appointments.controller'
import { AppointmentsService } from './appointments.service'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    QuotasModule,
  ],
  controllers: [
    AppointmentsController,
  ],
  providers: [
    AppointmentsService,
  ],
})
export class AppointmentsModule {}
