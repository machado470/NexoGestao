import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { RiskModule } from '../risk/risk.module'
import { TimelineModule } from '../timeline/timeline.module'

import { OperationalStateService } from './operational-state.service'
import { OperationalStateGuard } from './operational-state.guard'
import { OperationalStateRepository } from './operational-state.repository'

@Module({
  imports: [
    PrismaModule,
    RiskModule,
    TimelineModule,
  ],
  providers: [
    OperationalStateService,
    OperationalStateRepository,
    OperationalStateGuard,
  ],
  exports: [
    OperationalStateService,
    OperationalStateGuard, // ✅ EXPORT EXPLÍCITO DO GUARD
  ],
})
export class OperationalStateModule {}
