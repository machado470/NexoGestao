import { Injectable } from '@nestjs/common'

type MetricKey =
  | 'executionsCompleted'
  | 'chargesCreated'
  | 'paymentsProcessed'
  | 'idempotencyReplays'
  | 'idempotencyConflicts'
  | 'idempotencyInProgress'
  | 'integrationTemporaryFailures'
  | `executionActionStatus:${'executed' | 'blocked' | 'throttled' | 'failed'}`
  | `financeOperationStatus:${'executed' | 'blocked' | 'skipped' | 'duplicate' | 'retry_scheduled' | 'failed' | 'degraded' | 'queued'}`
  | `providerTimeouts:${string}`
  | `errorsByEndpoint:${string}`
  | `requestsByEndpoint:${string}`
  | `latencyByEndpoint:${string}:count`
  | `latencyByEndpoint:${string}:totalMs`

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

  incrementRequestByEndpoint(endpoint: string) {
    this.increment(`requestsByEndpoint:${endpoint}`)
  }

  observeEndpointLatency(endpoint: string, latencyMs: number) {
    this.increment(`latencyByEndpoint:${endpoint}:count`)
    this.increment(`latencyByEndpoint:${endpoint}:totalMs`, latencyMs)
  }

  snapshot() {
    const errorsByEndpoint: Record<string, number> = {}
    const requestsByEndpoint: Record<string, number> = {}
    const endpointLatency: Record<string, { count: number; totalMs: number; avgMs: number }> = {}

    for (const [key, value] of this.counters.entries()) {
      if (key.startsWith('errorsByEndpoint:')) {
        errorsByEndpoint[key.replace('errorsByEndpoint:', '')] = value
      }
      if (key.startsWith('requestsByEndpoint:')) {
        requestsByEndpoint[key.replace('requestsByEndpoint:', '')] = value
      }
      if (key.startsWith('latencyByEndpoint:') && key.endsWith(':count')) {
        const endpoint = key.replace('latencyByEndpoint:', '').replace(':count', '')
        endpointLatency[endpoint] = {
          count: value,
          totalMs: this.counters.get(`latencyByEndpoint:${endpoint}:totalMs`) ?? 0,
          avgMs: 0,
        }
      }
    }

    for (const endpoint of Object.keys(endpointLatency)) {
      const sample = endpointLatency[endpoint]
      endpointLatency[endpoint] = {
        ...sample,
        avgMs: sample.count > 0 ? Number((sample.totalMs / sample.count).toFixed(2)) : 0,
      }
    }

    return {
      executionsCompleted: this.counters.get('executionsCompleted') ?? 0,
      chargesCreated: this.counters.get('chargesCreated') ?? 0,
      paymentsProcessed: this.counters.get('paymentsProcessed') ?? 0,
      idempotencyReplays: this.counters.get('idempotencyReplays') ?? 0,
      idempotencyConflicts: this.counters.get('idempotencyConflicts') ?? 0,
      idempotencyInProgress: this.counters.get('idempotencyInProgress') ?? 0,
      integrationTemporaryFailures: this.counters.get('integrationTemporaryFailures') ?? 0,
      executionActionStatus: {
        executed: this.counters.get('executionActionStatus:executed') ?? 0,
        blocked: this.counters.get('executionActionStatus:blocked') ?? 0,
        throttled: this.counters.get('executionActionStatus:throttled') ?? 0,
        failed: this.counters.get('executionActionStatus:failed') ?? 0,
      },
      financeOperationStatus: {
        executed: this.counters.get('financeOperationStatus:executed') ?? 0,
        blocked: this.counters.get('financeOperationStatus:blocked') ?? 0,
        skipped: this.counters.get('financeOperationStatus:skipped') ?? 0,
        duplicate: this.counters.get('financeOperationStatus:duplicate') ?? 0,
        queued: this.counters.get('financeOperationStatus:queued') ?? 0,
        retryScheduled: this.counters.get('financeOperationStatus:retry_scheduled') ?? 0,
        failed: this.counters.get('financeOperationStatus:failed') ?? 0,
        degraded: this.counters.get('financeOperationStatus:degraded') ?? 0,
      },
      errorsByEndpoint,
      requestsByEndpoint,
      endpointLatency,
    }
  }
}
