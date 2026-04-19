import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ExpensesController } from './expenses.controller'
import { ExpensesService } from './expenses.service'
import { TimelineModule } from '../timeline/timeline.module'

@Module({
  imports: [PrismaModule, TimelineModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
