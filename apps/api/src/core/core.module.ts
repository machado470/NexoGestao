import { Global, Module } from '@nestjs/common'
import { RequestContextService } from '../common/context/request-context.service'
import { MetricsService } from '../common/metrics/metrics.service'
import { IdempotencyService } from '../common/idempotency/idempotency.service'

@Global()
@Module({
  providers: [RequestContextService, MetricsService, IdempotencyService],
  exports: [RequestContextService, MetricsService, IdempotencyService],
})
export class CoreModule {}
