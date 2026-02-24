import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'

import { FinanceController } from './finance.controller'
import { FinanceService } from './finance.service'

@Module({
  imports: [PrismaModule, TimelineModule, AuditModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
