import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { RiskService } from './risk.service'
import { TemporalRiskService } from './temporal-risk.service'

@Module({
  imports: [PrismaModule, TimelineModule],
  providers: [RiskService, TemporalRiskService],
  exports: [RiskService, TemporalRiskService],
})
export class RiskModule {}
