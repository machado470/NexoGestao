import { Module } from '@nestjs/common'
import { AdminOverviewService } from './admin-overview.service'
import { AdminOverviewController } from './admin-overview.controller'
import { ReportsModule } from '../reports/reports.module'
import { PendingModule } from '../pending/pending.module'
import { RiskModule } from '../risk/risk.module'

@Module({
  imports: [
    ReportsModule,
    PendingModule,
    RiskModule,
  ],
  controllers: [AdminOverviewController],
  providers: [AdminOverviewService],
})
export class AdminModule {}
