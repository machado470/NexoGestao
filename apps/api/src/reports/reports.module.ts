import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { OperationalStateModule } from '../people/operational-state.module'

import { ReportsService } from './reports.service'
import { ReportsController } from './reports.controller'
import { ExecutiveMetricsService } from './executive-metrics.service'
import { ExecutiveDashboardService } from './executive-dashboard.service'
import { ExecutiveDashboardController } from './executive-dashboard.controller'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    OperationalStateModule,
  ],
  providers: [
    ReportsService,
    ExecutiveMetricsService,
    ExecutiveDashboardService,
  ],
  controllers: [
    ReportsController,
    ExecutiveDashboardController,
  ],
})
export class ReportsModule {}
