import { QueueMetricsExporterService } from './queue-metrics-exporter.service'

describe('QueueMetricsExporterService', () => {
  it('normaliza snapshot em payload JSON estável', () => {
    const queueObservability = {
      snapshot: jest.fn().mockReturnValue({
        counters: {
          'queue.degraded.total': 2,
          'webhook.dispatch.failed.total': 4,
        },
        gauges: {
          'queue.backlog.waiting.whatsapp': 8,
        },
        duration: {
          'webhook.dispatch.latency_ms': {
            count: 3,
            totalMs: 120,
            avgMs: 40,
          },
        },
      }),
    } as any

    const service = new QueueMetricsExporterService(queueObservability)
    const result = service.exportJson()

    expect(result.exporter).toBe('queue-observability-v1')
    expect(result.generatedAt).toEqual(expect.any(String))
    expect(result.metrics.counters).toEqual(
      expect.arrayContaining([{ name: 'queue.degraded.total', type: 'counter', value: 2 }]),
    )
    expect(result.metrics.gauges).toEqual(
      expect.arrayContaining([{ name: 'queue.backlog.waiting.whatsapp', type: 'gauge', value: 8 }]),
    )
    expect(result.metrics.durations).toEqual(
      expect.arrayContaining([
        {
          name: 'webhook.dispatch.latency_ms',
          type: 'duration',
          unit: 'ms',
          count: 3,
          totalMs: 120,
          avgMs: 40,
        },
      ]),
    )
  })
})
