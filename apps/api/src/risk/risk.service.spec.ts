import { RiskService } from './risk.service'

describe('RiskService org hardening', () => {
  const prisma = {
    person: { findFirst: jest.fn(), update: jest.fn() },
    riskSnapshot: { create: jest.fn() },
    appointment: { count: jest.fn() },
    charge: { count: jest.fn() },
  } as any

  const temporalRisk = {
    calculate: jest.fn(),
    calculateDetailed: jest.fn(),
  } as any

  const timeline = { log: jest.fn() } as any

  let service: RiskService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new RiskService(prisma, temporalRisk, timeline)
  })

  it('enforces orgId on getPersonRiskExplanation', async () => {
    temporalRisk.calculateDetailed.mockResolvedValue({ score: 10 })
    prisma.person.findFirst.mockResolvedValue({ id: 'p1', name: 'A', riskScore: 1, operationalState: 'NORMAL' })

    await service.getPersonRiskExplanation('p1', 'org-a')

    expect(prisma.person.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', orgId: 'org-a' } }),
    )
    expect(temporalRisk.calculateDetailed).toHaveBeenCalledWith('p1', 'org-a')
  })

  it('writes risk snapshot timeline with org-scoped person', async () => {
    prisma.person.findFirst.mockResolvedValue({ orgId: 'org-a', riskScore: 40, operationalState: 'NORMAL' })

    await service.snapshot('p1', 77, 'manual', 'org-a')

    expect(prisma.person.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', orgId: 'org-a' } }),
    )
    expect(timeline.log).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-a', action: 'RISK_SNAPSHOT_CREATED' }),
    )
    expect(timeline.log).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-a',
        action: 'RISK_UPDATED',
        metadata: expect.objectContaining({
          previousRisk: 40,
          nextRisk: 77,
          score: 77,
          reason: 'manual',
          entityType: 'Person',
          entityId: 'p1',
        }),
      }),
    )
  })
})
