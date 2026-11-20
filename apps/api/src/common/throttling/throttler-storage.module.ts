import { Module } from '@nestjs/common'
import type IORedis from 'ioredis'
import { QUEUE_CONNECTION } from '../../queue/queue.constants'
import { NexoThrottlerStorage } from './redis-throttler.storage'

/**
 * Provides the throttler storage. In redis mode it duplicates the global queue connection
 * (same REDIS_URL, same Redis service) with fail-fast options; in memory mode it opens nothing.
 */
@Module({
  providers: [
    {
      provide: NexoThrottlerStorage,
      useFactory: (queueConnection?: IORedis) => NexoThrottlerStorage.fromEnvironment(queueConnection),
      inject: [{ token: QUEUE_CONNECTION, optional: true }],
    },
  ],
  exports: [NexoThrottlerStorage],
})
export class NexoThrottlerStorageModule {}
