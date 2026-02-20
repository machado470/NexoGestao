import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'

import { CustomersController } from './customers.controller'
import { CustomersService } from './customers.service'

@Module({
  imports: [
    PrismaModule,
    TimelineModule,
    AuditModule,
  ],
  controllers: [
    CustomersController,
  ],
  providers: [
    CustomersService,
  ],
})
export class CustomersModule {}
