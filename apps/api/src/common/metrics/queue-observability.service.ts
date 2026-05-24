import { Injectable } from '@nestjs/common'

@Injectable()
export class QueueObservabilityService {
  private readonly counters = new Map<string, number>()
  private readonly gauges = new Map<string, number>()
  private readonly timings = new Map<string, { count: number; totalMs: number }>()

  increment(name: string, by = 1) {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by)
  }

  setGauge(name: string, value: number) {
    this.gauges.set(name, value)
  }

  observeDuration(name: string, latencyMs: number) {
    const current = this.timings.get(name) ?? { count: 0, totalMs: 0 }
    this.timings.set(name, { count: current.count + 1, totalMs: current.totalMs + latencyMs })
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
