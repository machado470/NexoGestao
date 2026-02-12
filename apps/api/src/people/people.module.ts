import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { AuditModule } from '../audit/audit.module'
import { TimelineModule } from '../timeline/timeline.module'

import { PeopleService } from './people.service'
import { PeopleController } from './people.controller'

@Module({
  imports: [PrismaModule, AuditModule, TimelineModule],
  providers: [PeopleService],
  controllers: [PeopleController],
  exports: [PeopleService],
})
export class PeopleModule {}
