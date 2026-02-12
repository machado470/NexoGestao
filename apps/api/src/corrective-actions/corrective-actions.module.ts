import { Module } from '@nestjs/common'
import { CorrectiveActionsController } from './corrective-actions.controller'
import { CorrectiveActionsService } from './corrective-actions.service'
import { TimelineModule } from '../timeline/timeline.module'
import { OperationalStateModule } from '../people/operational-state.module'
import { RiskModule } from '../risk/risk.module'

@Module({
  imports: [TimelineModule, OperationalStateModule, RiskModule],
  controllers: [CorrectiveActionsController],
  providers: [CorrectiveActionsService],
  exports: [CorrectiveActionsService],
})
export class CorrectiveActionsModule {}
