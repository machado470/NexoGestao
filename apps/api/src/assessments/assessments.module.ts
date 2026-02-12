import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { RiskModule } from '../risk/risk.module'
import { AuditModule } from '../audit/audit.module'
import { CorrectiveActionsModule } from '../corrective-actions/corrective-actions.module'
import { OperationalStateModule } from '../people/operational-state.module'
import { TimelineModule } from '../timeline/timeline.module'

import { AssessmentsService } from './assessments.service'
import { AssessmentsController } from './assessments.controller'

@Module({
  imports: [
    PrismaModule,
    RiskModule,
    AuditModule,
    CorrectiveActionsModule,

    // ✅ Guard + dependência indireta (TimelineService)
    OperationalStateModule,
    TimelineModule,
  ],
  providers: [
    AssessmentsService,
  ],
  controllers: [
    AssessmentsController,
  ],
  exports: [
    AssessmentsService,
  ],
})
export class AssessmentsModule {}
