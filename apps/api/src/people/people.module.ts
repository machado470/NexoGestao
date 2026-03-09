import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'
import { RiskModule } from '../risk/risk.module'

import { PeopleService } from './people.service'
import { PeopleController } from './people.controller'
import { OperationalStateService } from './operational-state.service'
import { OperationalStateRepository } from './operational-state.repository'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
    RiskModule
  ],
  providers: [
    PeopleService,
    OperationalStateService,
    OperationalStateRepository
  ],
  controllers: [
    PeopleController
  ],
  exports: [
    PeopleService,
    OperationalStateService
  ]
})
export class PeopleModule {}
