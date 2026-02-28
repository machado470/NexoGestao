import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { RiskModule } from '../risk/risk.module'
import { TimelineModule } from '../timeline/timeline.module'

import { OperationalStateService } from './operational-state.service'
import { OperationalStateGuard } from './operational-state.guard'
import { OperationalStateRepository } from './operational-state.repository'
import { OperationalStateJob } from './operational-state.job'
import { OperationalStateScheduler } from './operational-state.scheduler'

@Module({
  imports: [PrismaModule, RiskModule, TimelineModule],
  providers: [
    OperationalStateService,
    OperationalStateRepository,
    OperationalStateGuard,
    OperationalStateJob,
    OperationalStateScheduler,
  ],
  exports: [
    OperationalStateService,
    OperationalStateRepository, // ✅ necessário pro JobsModule injetar no OperationalStateJob
    OperationalStateGuard,
    OperationalStateJob, // ✅ IMPORTANTÍSSIMO
  ],
})
export class OperationalStateModule {}
