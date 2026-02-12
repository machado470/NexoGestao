import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { TimelineModule } from './timeline/timeline.module'
import { RiskModule } from './risk/risk.module'
import { GovernanceModule } from './governance/governance.module'
import { OperationalStateModule } from './people/operational-state.module'

import { EnforcementJob } from './governance/enforcement.job'
import { OperationalStateJob } from './people/operational-state.job'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    RiskModule,
    GovernanceModule,
    OperationalStateModule,
  ],
  providers: [
    EnforcementJob,
    OperationalStateJob,
  ],
})
export class JobsModule {}
