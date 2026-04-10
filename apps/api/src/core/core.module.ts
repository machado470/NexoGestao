import { Global, Module } from '@nestjs/common'
import { RequestContextService } from '../common/context/request-context.service'
import { MetricsService } from '../common/metrics/metrics.service'
import { IdempotencyService } from '../common/idempotency/idempotency.service'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'

@Global()
@Module({
  providers: [
    RequestContextService,
    MetricsService,
    IdempotencyService,
    TenantOperationsService,
  ],
  exports: [
    RequestContextService,
    MetricsService,
    IdempotencyService,
    TenantOperationsService,
  ],
})
export class CoreModule {}
