import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'

import { GovernanceRunService } from './governance-run.service'
import { GovernanceRunJob } from './governance-run.job'

import { EnforcementPolicyService } from './enforcement-policy.service'
import { EnforcementEngineService } from './enforcement-engine.service'
import { EnforcementJob } from './enforcement.job'
import { EnforcementController } from './enforcement.controller'

// Leitura de dados de governança — controller e service existiam mas não estavam registrados
import { GovernanceReadController } from './governance-read.controller'
import { GovernanceReadService } from './governance-read.service'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
  ],
  controllers: [
    EnforcementController,
    GovernanceReadController,
  ],
  providers: [
    GovernanceRunService,
    GovernanceRunJob,

    EnforcementPolicyService,
    EnforcementEngineService,
    EnforcementJob,

    GovernanceReadService,
  ],
  exports: [
    GovernanceRunService,
    GovernanceRunJob,

    EnforcementPolicyService,
    EnforcementEngineService,
    EnforcementJob,

    GovernanceReadService,
  ],
})
export class GovernanceModule {}
