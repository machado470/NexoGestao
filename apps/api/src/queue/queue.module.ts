import { Global, Module } from '@nestjs/common'
import IORedis from 'ioredis'
import { PrismaModule } from '../prisma/prisma.module'
import { QUEUE_CONNECTION } from './queue.constants'
import { QueueController } from './queue.controller'
import { QueueService } from './queue.service'

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [QueueController],
  providers: [
    {
      provide: QUEUE_CONNECTION,
      useFactory: () => {
        const host = process.env.REDIS_HOST ?? 'localhost'
        const port = Number(process.env.REDIS_PORT ?? 6379)
        return new IORedis({ host, port, maxRetriesPerRequest: null })
      },
    },
    QueueService,
  ],
  exports: [QUEUE_CONNECTION, QueueService],
})
export class QueueModule {}
