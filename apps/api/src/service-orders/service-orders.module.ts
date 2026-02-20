import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'
import { AuditModule } from '../audit/audit.module'

import { ServiceOrdersController } from './service-orders.controller'
import { ServiceOrdersService } from './service-orders.service'

@Module({
  imports: [PrismaModule, TimelineModule, AuditModule],
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService],
})
export class ServiceOrdersModule {}
