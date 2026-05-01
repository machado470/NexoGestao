import { Controller, Get } from '@nestjs/common'
import { QueueService } from '../queue/queue.service'
import { WhatsAppObservabilityService } from '../common/metrics/whatsapp-observability.service'

@Controller('internal')
export class InternalStatsController {
  constructor(
    private readonly queueService: QueueService,
    private readonly waMetrics: WhatsAppObservabilityService,
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
}
