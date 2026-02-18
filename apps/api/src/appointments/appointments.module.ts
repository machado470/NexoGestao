import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineModule } from '../timeline/timeline.module'

import { AppointmentsController } from './appointments.controller'
import { AppointmentsService } from './appointments.service'

@Module({
  imports: [PrismaModule, TimelineModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
