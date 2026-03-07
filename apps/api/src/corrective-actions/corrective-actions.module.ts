import { Module } from '@nestjs/common'

import { CorrectiveActionsController } from './corrective-actions.controller'
import { CorrectiveActionsService } from './corrective-actions.service'

import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { OperationalStateModule } from '../people/operational-state.module'
import { RiskModule } from '../risk/risk.module'
import { AuditModule } from '../audit/audit.module'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    OperationalStateModule,
    RiskModule,
    AuditModule
  ],
  controllers: [CorrectiveActionsController],
  providers: [CorrectiveActionsService],
  exports: [CorrectiveActionsService],
})
export class CorrectiveActionsModule {}
