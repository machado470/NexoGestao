import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { FinanceModule } from '../finance/finance.module'
import { AuditModule } from '../audit/audit.module'

import { ExecutionController } from './execution.controller'
import { ExecutionService } from './execution.service'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    FinanceModule,
    AuditModule,
  ],
  controllers: [ExecutionController],
  providers: [ExecutionService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
