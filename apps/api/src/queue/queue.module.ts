import { Global, Logger, Module } from '@nestjs/common'
import IORedis from 'ioredis'
import { PrismaModule } from '../prisma/prisma.module'
import { QUEUE_CONNECTION } from './queue.constants'
import { QueueController } from './queue.controller'
import { QueueService } from './queue.service'

function parseRedisConfig() {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL)
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      username: url.username || undefined,
      db: url.pathname ? Number(url.pathname.replace('/', '') || 0) : 0,
    }
  }

  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
  }
}

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [QueueController],
  providers: [
    {
      provide: QUEUE_CONNECTION,
      useFactory: () => {
        const logger = new Logger('QueueConnectionFactory')
        const config = parseRedisConfig()
        logger.log(`Redis target ${config.host}:${config.port} db=${config.db}`)

        return new IORedis({
          ...config,
          maxRetriesPerRequest: null,
          lazyConnect: true,
          enableReadyCheck: true,
          connectTimeout: 10000,
        })
      },
    },
    QueueService,
  ],
  exports: [QUEUE_CONNECTION, QueueService],
})
export class QueueModule {}
