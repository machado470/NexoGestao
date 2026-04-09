import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { FinanceModule } from '../finance/finance.module'

import { ExecutionController } from './execution.controller'
import { ExecutionService } from './execution.service'
import { ExecutionRunner } from './execution.runner'
import { ExecutionScheduler } from './execution.scheduler'
import { ExecutionConfigService } from './execution.config'
import { ExecutionGovernanceService } from './execution.governance'
import { ExecutionEventsService } from './execution.events'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    FinanceModule,
  ],
  controllers: [ExecutionController],
  providers: [
    ExecutionService,
    ExecutionRunner,
    ExecutionScheduler,
    ExecutionConfigService,
    ExecutionGovernanceService,
    ExecutionEventsService,
  ],
  exports: [ExecutionService, ExecutionRunner, ExecutionConfigService],
})
export class ExecutionModule {}
