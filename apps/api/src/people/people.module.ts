import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { AuditModule } from '../audit/audit.module'
import { TimelineModule } from '../timeline/timeline.module'
import { RiskModule } from '../risk/risk.module'

import { PeopleService } from './people.service'
import { PeopleController } from './people.controller'

// ✅ importa o módulo correto (traz service/repo/guard/job/scheduler)
import { OperationalStateModule } from './operational-state.module'

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    TimelineModule,
    RiskModule,
    OperationalStateModule,
  ],
  providers: [PeopleService],
  controllers: [PeopleController],
  exports: [PeopleService],
})
export class PeopleModule {}
