import { OperationsController } from './operations.controller'

describe('OperationsController', () => {
  it('expõe endpoints agregados', async () => {
    const monitoring = {
      summary: jest.fn().mockResolvedValue({ metrics: {} }),
      queues: jest.fn().mockResolvedValue([]),
      dlq: jest.fn().mockResolvedValue([]),
    }
    const incidents = { list: jest.fn().mockResolvedValue([{ severity: 'WARNING' }, { severity: 'INFO' }]) }
    const controller = new OperationsController(monitoring as any, incidents as any)

    await expect(controller.summary()).resolves.toEqual({ metrics: {} })
    await expect(controller.queues()).resolves.toEqual([])
    await expect(controller.dlq()).resolves.toEqual([])
    await expect(controller.incidentsFeed()).resolves.toHaveLength(2)
    await expect(controller.recentFailures({ user: { orgId: 'org1' } })).resolves.toEqual({ orgId: 'org1', incidents: [{ severity: 'WARNING' }], metrics: {} })
  })
})
