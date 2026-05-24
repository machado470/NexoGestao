import { InternalStatsController } from './internal-stats.controller'

describe('InternalStatsController operational signals', () => {
  it('respeita orgId do token', async () => {
    const controller = new InternalStatsController({ getQueueStatus: jest.fn(), } as any, { snapshot: jest.fn() } as any, { runForOrg: jest.fn() } as any, { listForOrg: jest.fn().mockResolvedValue({ orgId: 'org-1', signals: [] }), getNextBestAction: jest.fn() } as any, { snapshot: jest.fn().mockReturnValue({ counters: {}, gauges: {}, duration: {} }) } as any)
    await controller.operationalSignals({ user: { orgId: 'org-1' } }, '20')
    expect((controller as any).operationalSignalsService.listForOrg).toHaveBeenCalledWith('org-1', 20)
  })
})
