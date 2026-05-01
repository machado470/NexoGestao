import { Injectable } from '@nestjs/common'

@Injectable()
export class WhatsAppObservabilityService {
  outboundTotal = 0
  inboundTotal = 0
  failedJobsTotal = 0
  retryTotal = 0
  processingSamples: number[] = []

  incOutbound() { this.outboundTotal += 1 }
  incInbound() { this.inboundTotal += 1 }
  incFailedJobs() { this.failedJobsTotal += 1 }
  incRetry() { this.retryTotal += 1 }
  observeProcessingDuration(ms: number) { this.processingSamples.push(ms) }

  snapshot() {
    const total = this.processingSamples.reduce((a, b) => a + b, 0)
    const count = this.processingSamples.length
    return {
      whatsapp_outbound_total: this.outboundTotal,
      whatsapp_inbound_total: this.inboundTotal,
      whatsapp_failed_jobs_total: this.failedJobsTotal,
      whatsapp_retry_total: this.retryTotal,
      whatsapp_processing_duration_ms_avg: count ? total / count : 0,
    }
  }
}
