import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { OperationalStateModule } from '../people/operational-state.module'
import { FinanceModule } from '../finance/finance.module'

import { ServiceOrdersController } from './service-orders.controller'
import { ServiceOrdersService } from './service-orders.service'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    OperationalStateModule,
    FinanceModule,
  ],
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
