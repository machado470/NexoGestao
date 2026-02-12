import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'

import { RiskService } from './risk.service'
import { TemporalRiskService } from './temporal-risk.service'
import { RiskSnapshotService } from './risk-snapshot.service'

@Module({
  imports: [
    PrismaModule,
  ],
  providers: [
    RiskService,
    TemporalRiskService,
    RiskSnapshotService,
  ],
  exports: [
    RiskService,
    TemporalRiskService,
    RiskSnapshotService, // 🔥 ISSO QUE ESTAVA FALTANDO
  ],
})
export class RiskModule {}
