import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { QueueModule } from '../queue/queue.module'
import { InternalStatsController } from './internal-stats.controller'
import { WhatsAppObservabilityService } from '../common/metrics/whatsapp-observability.service'
import { OperationalDiagnosticsService } from './operational-diagnostics.service'
import { OperationalSignalsService } from './operational-signals.service'
import { QueueMetricsExporterService } from '../common/metrics/queue-metrics-exporter.service'
import { OperationsController } from './operations.controller'
import { OperationalMonitoringService } from './operational-monitoring.service'
import { OperationalIncidentsService } from './operational-incidents.service'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { NotificationsModule } from '../notifications/notifications.module'
import { OutboxModule } from '../outbox/outbox.module'
import { BillingModule } from '../billing/billing.module'

@Module({
  imports: [PrismaModule, QueueModule, NotificationsModule, OutboxModule, BillingModule],
  controllers: [HealthController, InternalStatsController, OperationsController],
  providers: [WhatsAppObservabilityService, OperationalDiagnosticsService, OperationalSignalsService, QueueMetricsExporterService, OperationalMonitoringService, OperationalIncidentsService, ActiveUserGuard],
  exports: [WhatsAppObservabilityService],
})
export class HealthModule {}
