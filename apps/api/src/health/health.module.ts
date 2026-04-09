import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { QueueModule } from '../queue/queue.module'

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [HealthController],
})
export class HealthModule {}
