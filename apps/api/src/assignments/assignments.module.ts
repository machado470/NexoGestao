import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { OperationalStateModule } from '../people/operational-state.module'
import { RiskModule } from '../risk/risk.module'

import { AssignmentsService } from './assignments.service'
import { AssignmentsController } from './assignments.controller'
import { AssignmentFactoryService } from './assignment-factory.service'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    OperationalStateModule,
    RiskModule,
  ],
  providers: [
    AssignmentsService,
    AssignmentFactoryService,
  ],
  controllers: [
    AssignmentsController,
  ],
  exports: [
    AssignmentsService,
    AssignmentFactoryService,
  ],
})
export class AssignmentsModule {}

