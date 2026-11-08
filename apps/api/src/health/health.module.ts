import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { PrismaModule } from '../prisma/prisma.module'
import { QueueModule } from '../queue/queue.module'
import { InternalStatsController } from './internal-stats.controller'
import { WhatsAppMetricsModule } from '../common/metrics/whatsapp-metrics.module'
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
import { DashboardModule } from '../dashboard/dashboard.module'
import { TenantOperationsController } from './tenant-operations.controller'
import { TenantOperationsService } from './tenant-operations.service'

@Module({
  imports: [WhatsAppMetricsModule, PrismaModule, QueueModule, NotificationsModule, OutboxModule, BillingModule, DashboardModule],
  controllers: [HealthController, InternalStatsController, OperationsController, TenantOperationsController],
  providers: [OperationalDiagnosticsService, OperationalSignalsService, QueueMetricsExporterService, OperationalMonitoringService, OperationalIncidentsService, TenantOperationsService, ActiveUserGuard],
  exports: [WhatsAppMetricsModule],
})
export class HealthModule {}
