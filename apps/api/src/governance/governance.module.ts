import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { OperationalStateModule } from '../people/operational-state.module'

import { EnforcementPolicyService } from './enforcement-policy.service'
import { EnforcementEngineService } from './enforcement-engine.service'
import { EnforcementJob } from './enforcement.job'
import { EnforcementController } from './enforcement.controller'
import { GovernanceRunService } from './governance-run.service'
import { GovernanceReadService } from './governance-read.service'
import { GovernanceReadController } from './governance-read.controller'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    OperationalStateModule,
  ],
  providers: [
    EnforcementPolicyService,
    EnforcementEngineService,
    EnforcementJob,
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
