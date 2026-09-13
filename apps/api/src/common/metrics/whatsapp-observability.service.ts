import { Injectable } from '@nestjs/common'
import { metrics } from '@opentelemetry/api'

@Injectable()
export class WhatsAppObservabilityService {
  private readonly meter = metrics.getMeter('nexogestao.whatsapp')
  private readonly events = this.meter.createCounter('nexo_whatsapp_events_total', { unit: '{event}' })
  private readonly duration = this.meter.createHistogram('nexo_whatsapp_processing_duration', { unit: 'ms' })
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

  private record(operation: string, status: string) { this.events.add(1, { operation, status }) }
  incOutbound() { this.outboundTotal += 1; this.record('message_outbound', 'completed') }
  incInbound() { this.inboundTotal += 1; this.record('message_inbound', 'completed') }
  incFailedJobs() { this.failedJobsTotal += 1; this.record('job', 'failed') }
  incFailedWebhook() { this.failedWebhookTotal += 1; this.record('webhook', 'failed') }
  incQueuedJobs() { this.queuedJobsTotal += 1; this.record('job', 'queued') }
  incRetry() { this.retryTotal += 1; this.record('job', 'retry') }
  incInboundWebhookQueued() { this.inboundWebhookQueuedTotal += 1; this.record('inbound_webhook', 'queued') }
  incInboundWebhookStarted() { this.inboundWebhookStartedTotal += 1; this.record('inbound_webhook', 'started') }
  incInboundWebhookCompleted() { this.inboundWebhookCompletedTotal += 1; this.record('inbound_webhook', 'completed') }
  incInboundWebhookFailed() { this.inboundWebhookFailedTotal += 1; this.record('inbound_webhook', 'failed') }
  incInboundWebhookDeadLettered() { this.inboundWebhookDeadLetteredTotal += 1; this.record('inbound_webhook', 'dead_letter') }
  observeProcessingDuration(ms: number) { this.processingSamples.push(ms); if (Number.isFinite(ms)) this.duration.record(ms, { operation: 'webhook_processing' }) }

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
