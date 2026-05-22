import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common'
import { QueueService } from '../queue/queue.service'
import { WhatsAppObservabilityService } from '../common/metrics/whatsapp-observability.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { OperationalDiagnosticsService } from './operational-diagnostics.service'
import { OperationalSignalsService } from './operational-signals.service'

@Controller('internal')
export class InternalStatsController {
  constructor(
    private readonly queueService: QueueService,
    private readonly waMetrics: WhatsAppObservabilityService,
    private readonly operationalDiagnosticsService: OperationalDiagnosticsService,
    private readonly operationalSignalsService: OperationalSignalsService,
  ) {}

  @Get('stats')
  async stats() {
    const queues = await this.queueService.getQueueStatus()
    const wa = this.waMetrics.snapshot()
    const totalJobs = Object.values(queues as any).reduce((acc: number, q: any) => acc + (q.waiting ?? 0) + (q.active ?? 0) + (q.completed ?? 0) + (q.failed ?? 0), 0)
    const failedJobs = Object.values(queues as any).reduce((acc: number, q: any) => acc + (q.failed ?? 0), 0)
    return {
      totalJobs,
      failedJobs,
      retryRate: wa.whatsapp_retry_total / Math.max(1, wa.whatsapp_outbound_total),
      avgProcessingTime: wa.whatsapp_processing_duration_ms_avg,
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('diagnostics/operational')
  async operationalDiagnostics(@Request() req: any, @Query('limit') limit?: string) {
    const parsedLimit = Number(limit ?? 100)
    return this.operationalDiagnosticsService.runForOrg(req.user.orgId, Number.isFinite(parsedLimit) ? parsedLimit : 100)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('operational-signals')
  async operationalSignals(@Request() req: any, @Query('limit') limit?: string) {
    const parsedLimit = Number(limit ?? 20)
    return this.operationalSignalsService.listForOrg(req.user.orgId, Number.isFinite(parsedLimit) ? parsedLimit : 20)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('operational-signals/next-best-action')
  async nextBestAction(@Request() req: any) {
    return this.operationalSignalsService.getNextBestAction(req.user.orgId)
  }
}


