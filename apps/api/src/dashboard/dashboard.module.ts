import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { GovernanceModule } from '../governance/governance.module'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { MemoryCacheService } from '../common/cache/memory-cache.service'

@Module({
  imports: [PrismaModule, GovernanceModule],
  controllers: [DashboardController],
  providers: [DashboardService, MemoryCacheService],
  exports: [DashboardService],
})
export class DashboardModule {}
