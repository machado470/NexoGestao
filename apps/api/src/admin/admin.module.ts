import { Module } from '@nestjs/common'
import { ReportsModule } from '../reports/reports.module'
import { PendingModule } from '../pending/pending.module'
import { RiskModule } from '../risk/risk.module'
import { OperationalStateModule } from '../people/operational-state.module'

import { AdminOverviewService } from './admin-overview.service'
import { AdminOverviewController } from './admin-overview.controller'
import { OperationalStateAdminController } from './operational-state.admin.controller'

@Module({
  imports: [
    ReportsModule,
    PendingModule,
    RiskModule,
    OperationalStateModule,
  ],
  controllers: [
    AdminOverviewController,
    OperationalStateAdminController,
  ],
  providers: [AdminOverviewService],
})
export class AdminModule {}
