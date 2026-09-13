import { Injectable } from '@nestjs/common'
import { metrics } from '@opentelemetry/api'
import { QUEUE_NAMES, QueueName } from '../../queue/queue.constants'

@Injectable()
export class QueueObservabilityService {
  private readonly counters = new Map<string, number>()
  private readonly gauges = new Map<string, number>()
  private readonly timings = new Map<string, { count: number; totalMs: number }>()
  private readonly meter = metrics.getMeter('nexogestao.queues')
  private readonly eventCounter = this.meter.createCounter('nexo_queue_events_total', { unit: '{event}' })
  private readonly durationHistogram = this.meter.createHistogram('nexo_queue_processing_duration', { unit: 'ms' })
  private readonly backlogGauge = this.meter.createObservableGauge('nexo_queue_jobs', { unit: '{job}' })

  constructor() {
    this.backlogGauge.addCallback((result) => {
      for (const [name, value] of this.gauges) {
        const match = /^queue\.backlog\.(waiting|active|delayed|failed)\.([a-z-]+)$/.exec(name)
        if (match && this.isQueueName(match[2])) result.observe(value, { status: match[1], queue: match[2] })
      }
    })
  }

  increment(name: string, by = 1) {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by)
    const attrs = this.counterAttributes(name)
    if (attrs) this.eventCounter.add(by, attrs)
  }

  setGauge(name: string, value: number) {
    this.gauges.set(name, value)
  }

  observeDuration(name: string, latencyMs: number) {
    const current = this.timings.get(name) ?? { count: 0, totalMs: 0 }
    this.timings.set(name, { count: current.count + 1, totalMs: current.totalMs + latencyMs })
    const operation = name === 'webhook.dispatch.latency_ms' ? 'webhook_dispatch'
      : name === 'whatsapp.inbound_webhook.latency_ms' ? 'whatsapp_inbound_webhook' : null
    if (operation && Number.isFinite(latencyMs)) this.durationHistogram.record(latencyMs, { operation })
  }

  private isQueueName(value: string): value is QueueName { return (Object.values(QUEUE_NAMES) as string[]).includes(value) }

  private counterAttributes(name: string): { operation: string; status: string; queue?: string } | null {
    const queueEvent = /^queue\.job\.(enqueue\.failed|enqueue\.success|stalled)\.([a-z-]+)$/.exec(name)
    if (queueEvent && this.isQueueName(queueEvent[2])) return { operation: 'job_' + queueEvent[1].replace('.', '_'), status: 'recorded', queue: queueEvent[2] }
    const fixed: Record<string, { operation: string; status: string }> = {
      'queue.degraded.total': { operation: 'queue_degraded', status: 'recorded' },
      'webhook.dispatch.failed.total': { operation: 'webhook_dispatch', status: 'failed' },
      'webhook.dispatch.retry.total': { operation: 'webhook_dispatch', status: 'retry' },
      'webhook.dispatch.dlq.total': { operation: 'webhook_dispatch', status: 'dead_letter' },
      'whatsapp.job.retry.total': { operation: 'whatsapp_job', status: 'retry' },
      'whatsapp.job.failed.total': { operation: 'whatsapp_job', status: 'failed' },
      'whatsapp.inbound_webhook.dlq.total': { operation: 'whatsapp_inbound_webhook', status: 'dead_letter' },
    }
    return fixed[name] ?? null
  }

  snapshot() {
    const duration = Object.fromEntries(
      Array.from(this.timings.entries()).map(([name, sample]) => [name, {
        count: sample.count,
        totalMs: sample.totalMs,
        avgMs: sample.count > 0 ? Number((sample.totalMs / sample.count).toFixed(2)) : 0,
      }]),
    )

    return {
      counters: Object.fromEntries(this.counters.entries()),
      gauges: Object.fromEntries(this.gauges.entries()),
      duration,
    }
  }
}
