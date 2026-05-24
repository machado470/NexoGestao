import { Injectable } from '@nestjs/common'
import { QueueObservabilityService } from './queue-observability.service'

type QueueDurationSample = { count: number; totalMs: number; avgMs: number }

type QueueSnapshot = {
  counters: Record<string, number>
  gauges: Record<string, number>
  duration: Record<string, QueueDurationSample>
}

@Injectable()
export class QueueMetricsExporterService {
  constructor(private readonly queueObservability: QueueObservabilityService) {}

  exportJson() {
    const snapshot = this.queueObservability.snapshot() as QueueSnapshot
    return {
      exporter: 'queue-observability-v1',
      generatedAt: new Date().toISOString(),
      metrics: {
        counters: this.normalizeFlatMetrics(snapshot.counters, 'counter'),
        gauges: this.normalizeFlatMetrics(snapshot.gauges, 'gauge'),
        durations: this.normalizeDurationMetrics(snapshot.duration),
      },
    }
  }

  private normalizeFlatMetrics(values: Record<string, number>, type: 'counter' | 'gauge') {
    return Object.entries(values).map(([name, value]) => ({
      name,
      type,
      value: Number.isFinite(value) ? Number(value) : 0,
    }))
  }

  private normalizeDurationMetrics(values: Record<string, QueueDurationSample>) {
    return Object.entries(values).map(([name, sample]) => ({
      name,
      type: 'duration',
      unit: 'ms',
      count: Number.isFinite(sample.count) ? Number(sample.count) : 0,
      totalMs: Number.isFinite(sample.totalMs) ? Number(sample.totalMs) : 0,
      avgMs: Number.isFinite(sample.avgMs) ? Number(sample.avgMs) : 0,
    }))
  }
}
