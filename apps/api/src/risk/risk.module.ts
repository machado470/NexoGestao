import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { RiskService } from './risk.service'
import { TemporalRiskService } from './temporal-risk.service'
import { RiskController } from './risk.controller'

@Module({
  imports: [PrismaModule, TimelineModule],
  controllers: [RiskController],
  providers: [RiskService, TemporalRiskService],
  exports: [RiskService, TemporalRiskService],
})
export class RiskModule {}
