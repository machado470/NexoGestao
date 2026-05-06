import { Injectable } from '@nestjs/common'

@Injectable()
export class WhatsAppObservabilityService {
  outboundTotal = 0
  inboundTotal = 0
  failedJobsTotal = 0
  failedWebhookTotal = 0
  queuedJobsTotal = 0
  retryTotal = 0
  inboundWebhookQueuedTotal = 0
  inboundWebhookStartedTotal = 0
  inboundWebhookCompletedTotal = 0
  inboundWebhookFailedTotal = 0
  inboundWebhookDeadLetteredTotal = 0
  processingSamples: number[] = []

  incOutbound() { this.outboundTotal += 1 }
  incInbound() { this.inboundTotal += 1 }
  incFailedJobs() { this.failedJobsTotal += 1 }
  incFailedWebhook() { this.failedWebhookTotal += 1 }
  incQueuedJobs() { this.queuedJobsTotal += 1 }
  incRetry() { this.retryTotal += 1 }
  incInboundWebhookQueued() { this.inboundWebhookQueuedTotal += 1 }
  incInboundWebhookStarted() { this.inboundWebhookStartedTotal += 1 }
  incInboundWebhookCompleted() { this.inboundWebhookCompletedTotal += 1 }
  incInboundWebhookFailed() { this.inboundWebhookFailedTotal += 1 }
  incInboundWebhookDeadLettered() { this.inboundWebhookDeadLetteredTotal += 1 }
  observeProcessingDuration(ms: number) { this.processingSamples.push(ms) }

  snapshot() {
    const total = this.processingSamples.reduce((a, b) => a + b, 0)
    const count = this.processingSamples.length
    return {
      whatsapp_outbound_total: this.outboundTotal,
      whatsapp_inbound_total: this.inboundTotal,
      whatsapp_failed_jobs_total: this.failedJobsTotal,
      whatsapp_failed_webhook_total: this.failedWebhookTotal,
      whatsapp_queued_jobs_total: this.queuedJobsTotal,
      whatsapp_retry_total: this.retryTotal,
      whatsapp_inbound_webhook_queued_total: this.inboundWebhookQueuedTotal,
      whatsapp_inbound_webhook_started_total: this.inboundWebhookStartedTotal,
      whatsapp_inbound_webhook_completed_total: this.inboundWebhookCompletedTotal,
      whatsapp_inbound_webhook_failed_total: this.inboundWebhookFailedTotal,
      whatsapp_inbound_webhook_dead_lettered_total: this.inboundWebhookDeadLetteredTotal,
      whatsapp_processing_duration_ms_avg: count ? total / count : 0,
    }
  }
}
