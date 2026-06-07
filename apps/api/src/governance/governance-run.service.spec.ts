import { GovernanceRunService } from './governance-run.service'

describe('GovernanceRunService canonical events', () => {
  it('emite GOVERNANCE_RUN_STARTED ao iniciar ciclo', async () => {
    const prisma = {
      correctiveAction: { count: jest.fn() },
      governanceRun: { upsert: jest.fn() },
    }
    const timeline = { log: jest.fn().mockResolvedValue(undefined) }
    const service = new GovernanceRunService(prisma as any, timeline as any)

    await service.startRun('org-1')

    expect(timeline.log).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-1',
        action: 'GOVERNANCE_RUN_STARTED',
        metadata: expect.objectContaining({ orgId: 'org-1' }),
      }),
    )
  })
})
