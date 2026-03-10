import { Global, Module } from '@nestjs/common'
import { RequestContextService } from '../common/context/request-context.service'
import { MetricsService } from '../common/metrics/metrics.service'

@Global()
@Module({
  providers: [RequestContextService, MetricsService],
  exports: [RequestContextService, MetricsService],
})
export class CoreModule {}
