import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { ExecutionController } from './execution.controller'
import { FinanceModule } from '../finance/finance.module'
import { ExecutionService } from './execution.service'

@Module({ imports: [PrismaModule, TimelineModule, FinanceModule], controllers: [ExecutionController], providers: [ExecutionService], exports: [ExecutionService] })
export class ExecutionModule {}
