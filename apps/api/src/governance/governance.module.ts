import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { RiskModule } from '../risk/risk.module'
import { OperationalStateModule } from '../people/operational-state.module'

import { GovernanceRunService } from './governance-run.service'
import { GovernanceRunJob } from './governance-run.job'

import { EnforcementPolicyService } from './enforcement-policy.service'
import { EnforcementEngineService } from './enforcement-engine.service'
import { EnforcementJob } from './enforcement.job'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,

    // ✅ deps do EnforcementEngineService
    RiskModule,
    OperationalStateModule,
  ],
  providers: [
    GovernanceRunService,
    GovernanceRunJob,

    // ✅ policy precisa ser provider (era o erro)
    EnforcementPolicyService,

    // ✅ engine + job
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
