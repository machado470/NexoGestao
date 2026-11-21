import { Module } from '@nestjs/common'
import { ReportsModule } from '../reports/reports.module'
import { PendingModule } from '../pending/pending.module'
import { RiskModule } from '../risk/risk.module'
import { OperationalStateModule } from '../people/operational-state.module'

import { AdminOverviewService } from './admin-overview.service'
import { AdminOverviewController } from './admin-overview.controller'
import { OperationalStateAdminController } from './operational-state.admin.controller'
import { PlatformAccessController } from './platform-access.controller'

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
    PlatformAccessController,
  ],
  providers: [AdminOverviewService],
})
export class AdminModule {}
