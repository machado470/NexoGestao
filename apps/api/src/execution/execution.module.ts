import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { FinanceModule } from '../finance/finance.module'

import { ExecutionController } from './execution.controller'
import { ExecutionService } from './execution.service'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    FinanceModule,
  ],
  controllers: [ExecutionController],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
