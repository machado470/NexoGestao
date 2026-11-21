import { Global, Module } from '@nestjs/common'
import type IORedis from 'ioredis'
import { QUEUE_CONNECTION } from '../../queue/queue.constants'
import { InternalAuthMiddleware } from './internal-auth.middleware'
import { InternalAuthService } from './internal-auth.service'

/** In off mode (default) no Redis connection is opened and the middleware is a no-op. */
@Global()
@Module({
  providers: [
    {
      provide: InternalAuthService,
      useFactory: (queueConnection?: IORedis) => InternalAuthService.fromEnvironment(queueConnection),
      inject: [{ token: QUEUE_CONNECTION, optional: true }],
    },
    InternalAuthMiddleware,
  ],
  exports: [InternalAuthService, InternalAuthMiddleware],
})
export class InternalAuthModule {}
