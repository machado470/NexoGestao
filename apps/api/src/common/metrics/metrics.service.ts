import { Injectable } from '@nestjs/common'

type MetricKey =
  | 'executionsCompleted'
  | 'chargesCreated'
  | 'paymentsProcessed'
  | `errorsByEndpoint:${string}`

@Injectable()
export class MetricsService {
  private readonly counters = new Map<MetricKey, number>()

  increment(metric: MetricKey, by = 1) {
    const current = this.counters.get(metric) ?? 0
    this.counters.set(metric, current + by)
  }

  incrementErrorByEndpoint(endpoint: string) {
    this.increment(`errorsByEndpoint:${endpoint}`)
  }

  snapshot() {
    const errorsByEndpoint: Record<string, number> = {}

    for (const [key, value] of this.counters.entries()) {
      if (key.startsWith('errorsByEndpoint:')) {
        errorsByEndpoint[key.replace('errorsByEndpoint:', '')] = value
      }
    }

    return {
      executionsCompleted: this.counters.get('executionsCompleted') ?? 0,
      chargesCreated: this.counters.get('chargesCreated') ?? 0,
      paymentsProcessed: this.counters.get('paymentsProcessed') ?? 0,
      errorsByEndpoint,
    }
  }
}

