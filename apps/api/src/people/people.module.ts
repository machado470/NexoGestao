import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { AuditModule } from '../audit/audit.module'
import { TimelineModule } from '../timeline/timeline.module'
import { RiskModule } from '../risk/risk.module'

import { PeopleService } from './people.service'
import { PeopleController } from './people.controller'

import { OperationalStateService } from './operational-state.service'
import { OperationalStateRepository } from './operational-state.repository'

@Module({
  imports: [PrismaModule, AuditModule, TimelineModule, RiskModule],
  providers: [
    PeopleService,
    OperationalStateService,
    OperationalStateRepository,
  ],
  controllers: [PeopleController],
  exports: [
    PeopleService,
    OperationalStateService,
    OperationalStateRepository,
  ],
})
export class PeopleModule {}
