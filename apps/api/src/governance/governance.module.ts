import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { OperationalStateModule } from '../people/operational-state.module'
import { RiskModule } from '../risk/risk.module'

import { EnforcementPolicyService } from './enforcement-policy.service'
import { EnforcementEngineService } from './enforcement-engine.service'
import { EnforcementJob } from './enforcement.job'
import { EnforcementController } from './enforcement.controller'
import { GovernanceRunService } from './governance-run.service'
import { GovernanceReadService } from './governance-read.service'
import { GovernanceReadController } from './governance-read.controller'
import { EnforcementScheduler } from './enforcement.scheduler'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    OperationalStateModule,
    RiskModule,
  ],
  providers: [
    EnforcementPolicyService,
    EnforcementEngineService,
    EnforcementJob,
    EnforcementScheduler,
    GovernanceRunService,
    GovernanceReadService,
  ],
  controllers: [
    EnforcementController,
    GovernanceReadController,
  ],
  exports: [
    EnforcementEngineService,
    GovernanceRunService,
    GovernanceReadService,
  ],
})
export class GovernanceModule {}
