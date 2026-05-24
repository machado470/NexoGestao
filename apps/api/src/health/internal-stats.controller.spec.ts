import { InternalStatsController } from './internal-stats.controller'

describe('InternalStatsController operational signals', () => {
  it('respeita orgId do token', async () => {
    const controller = new InternalStatsController(
      { getQueueStatus: jest.fn() } as any,
      { snapshot: jest.fn() } as any,
      { runForOrg: jest.fn() } as any,
      { listForOrg: jest.fn().mockResolvedValue({ orgId: 'org-1', signals: [] }), getNextBestAction: jest.fn() } as any,
      { snapshot: jest.fn().mockReturnValue({ counters: {}, gauges: {}, duration: {} }) } as any,
      { exportJson: jest.fn() } as any,
    )
    await controller.operationalSignals({ user: { orgId: 'org-1' } }, '20')
    expect((controller as any).operationalSignalsService.listForOrg).toHaveBeenCalledWith('org-1', 20)
  })

  it('mantém /internal/stats compatível e expõe /internal/metrics interno', async () => {
    const queueService = { getQueueStatus: jest.fn().mockResolvedValue({ whatsapp: { waiting: 1, active: 2, completed: 3, failed: 4 } }) }
    const waMetrics = { snapshot: jest.fn().mockReturnValue({ whatsapp_retry_total: 2, whatsapp_outbound_total: 4, whatsapp_processing_duration_ms_avg: 50 }) }
    const queueObservability = { snapshot: jest.fn().mockReturnValue({ counters: { a: 1 }, gauges: { b: 2 }, duration: {} }) }
    const queueMetricsExporter = { exportJson: jest.fn().mockReturnValue({ exporter: 'queue-observability-v1' }) }

    const controller = new InternalStatsController(
      queueService as any,
      waMetrics as any,
      { runForOrg: jest.fn() } as any,
      { listForOrg: jest.fn(), getNextBestAction: jest.fn() } as any,
      queueObservability as any,
      queueMetricsExporter as any,
    )

    const stats = await controller.stats()
    expect(stats).toMatchObject({
      queueObservability: { counters: { a: 1 }, gauges: { b: 2 }, duration: {} },
      totalJobs: 10,
      failedJobs: 4,
      retryRate: 0.5,
      avgProcessingTime: 50,
    })

    const metrics = controller.metrics()
    expect(metrics).toEqual({ exporter: 'queue-observability-v1' })
    expect(queueMetricsExporter.exportJson).toHaveBeenCalled()
  })
})
