import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PaymentsService } from './payments.service'
import { PaymentsController } from './payments.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { OperationalStateModule } from '../people/operational-state.module'
import { FinanceModule } from '../finance/finance.module'

@Module({
  imports: [ConfigModule, PrismaModule, FinanceModule, OperationalStateModule, TimelineModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
