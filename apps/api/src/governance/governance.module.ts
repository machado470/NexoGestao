import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'

import { GovernanceRunService } from './governance-run.service'
import { GovernanceRunJob } from './governance-run.job'

import { EnforcementPolicyService } from './enforcement-policy.service'
import { EnforcementEngineService } from './enforcement-engine.service'
import { EnforcementJob } from './enforcement.job'
import { EnforcementController } from './enforcement.controller'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
  ],
  controllers: [
    EnforcementController,
  ],
  providers: [
    GovernanceRunService,
    GovernanceRunJob,

    EnforcementPolicyService,
    EnforcementEngineService,
    EnforcementJob,
  ],
  exports: [
    GovernanceRunService,
    GovernanceRunJob,

    EnforcementPolicyService,
    EnforcementEngineService,
    EnforcementJob,
  ],
})
export class GovernanceModule {}
