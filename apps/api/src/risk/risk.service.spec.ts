import { RiskService } from './risk.service'

function buildPrisma(overrides: Record<string, unknown> = {}) {
  return {
    person: { findFirst: jest.fn(), update: jest.fn() },
    customer: { findFirst: jest.fn() },
    riskSnapshot: { create: jest.fn() },
    appointment: { count: jest.fn() },
    charge: { count: jest.fn(), aggregate: jest.fn() },
    payment: { count: jest.fn() },
    serviceOrder: { count: jest.fn() },
    whatsAppMessage: { count: jest.fn() },
    whatsAppConversation: { count: jest.fn() },
    timelineEvent: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    ...overrides,
  } as any
}

describe('RiskService org hardening', () => {
  const temporalRisk = {
    calculate: jest.fn(),
    calculateDetailed: jest.fn(),
  } as any

  const timeline = { log: jest.fn() } as any

  let prisma: ReturnType<typeof buildPrisma>
  let service: RiskService

  beforeEach(() => {
    jest.clearAllMocks()
    prisma = buildPrisma()
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
    prisma.person.findFirst.mockResolvedValue({ orgId: 'org-a', riskScore: 40, operationalRiskScore: 40, operationalState: 'NORMAL' })

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

describe('RiskService operational customer signals', () => {
  const temporalRisk = {
    calculate: jest.fn(),
    calculateDetailed: jest.fn(),
  } as any

  const timeline = { log: jest.fn() } as any
  let prisma: ReturnType<typeof buildPrisma>
  let service: RiskService

  beforeEach(() => {
    jest.clearAllMocks()
    prisma = buildPrisma()
    prisma.customer.findFirst.mockResolvedValue({ id: 'c1', orgId: 'org-a' })
    prisma.charge.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } })
    prisma.timelineEvent.findMany.mockResolvedValue([])
    prisma.timelineEvent.findFirst.mockResolvedValue(null)
    prisma.timelineEvent.count.mockResolvedValue(0)
    prisma.whatsAppMessage.count.mockResolvedValue(0)
    prisma.whatsAppConversation.count.mockResolvedValue(0)
    prisma.payment.count.mockResolvedValue(0)
    prisma.charge.count.mockResolvedValue(0)
    prisma.serviceOrder.count.mockResolvedValue(0)
    prisma.appointment.count.mockResolvedValue(0)
    service = new RiskService(prisma, temporalRisk, timeline)
  })

  it('calculates WARNING with overdue charge and preserves orgId in charge queries', async () => {
    prisma.charge.count.mockImplementation(({ where }: any) => {
      if (where.status === 'OVERDUE') return 3
      return 0
    })

    const result = await service.getCustomerOperationalRisk('org-a', 'c1')

    expect(result.state).toBe('WARNING')
    expect(result.contributors).toContain('OVERDUE_CHARGES')
    expect(prisma.charge.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-a', customerId: 'c1' }) }),
    )
  })

  it('calculates RESTRICTED with overdue service order plus high overdue amount', async () => {
    prisma.charge.count.mockImplementation(() => 0)
    prisma.charge.aggregate.mockResolvedValue({ _sum: { amountCents: 150_000 } })
    prisma.serviceOrder.count.mockImplementation(({ where }: any) => (where.dueDate?.lt ? 1 : 0))

    const result = await service.getCustomerOperationalRisk('org-a', 'c1')

    expect(result.state).toBe('RESTRICTED')
    expect(result.contributors).toEqual(expect.arrayContaining(['HIGH_OVERDUE_AMOUNT', 'OVERDUE_SERVICE_ORDERS']))
  })

  it('uses MESSAGE_FAILED as a risk signal', async () => {
    prisma.whatsAppMessage.count.mockResolvedValue(2)

    const result = await service.getCustomerOperationalRisk('org-a', 'c1')

    expect(result.factors.failedMessages).toBe(2)
    expect(result.contributors).toContain('MESSAGE_FAILURES')
  })

  it('uses recurring APPOINTMENT_CANCELLED signal through normalized timeline events', async () => {
    prisma.appointment.count.mockImplementation(({ where }: any) => (where.status === 'CANCELED' ? 3 : 0))
    prisma.timelineEvent.findMany.mockResolvedValue([
      { action: 'APPOINTMENT_CANCELLED' },
      { action: 'APPOINTMENT_CANCELED' },
      { action: 'UNKNOWN_EVENT' },
    ])

    const result = await service.getCustomerOperationalRisk('org-a', 'c1')

    expect(result.contributors).toContain('APPOINTMENT_CANCELLATIONS')
    expect(result.factors.canonicalTimelineEvents).toEqual(
      expect.arrayContaining(['APPOINTMENT_CANCELLED', 'UNKNOWN_EVENT']),
    )
  })

  it('emits RISK_UPDATED when recalculated risk changed', async () => {
    prisma.charge.count.mockImplementation(({ where }: any) => (where.status === 'OVERDUE' ? 3 : 0))
    prisma.timelineEvent.findFirst.mockResolvedValue({ metadata: { nextScore: 0, nextState: 'NORMAL' } })

    await service.recalculateCustomerOperationalRisk('org-a', 'c1', 'test')

    expect(timeline.log).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org-a',
        customerId: 'c1',
        action: 'RISK_UPDATED',
        metadata: expect.objectContaining({
          previousRisk: 0,
          nextRisk: 60,
          nextState: 'WARNING',
          reasons: expect.arrayContaining(['OVERDUE_CHARGES']),
          signals: expect.objectContaining({ overdueCharges: 3 }),
          entityType: 'Customer',
          entityId: 'c1',
        }),
      }),
    )
  })

  it('accepts unknown timeline events without breaking calculation', async () => {
    prisma.timelineEvent.findMany.mockResolvedValue([{ action: 'FUTURE_EVENT_CREATED' }])

    await expect(service.getCustomerOperationalRisk('org-a', 'c1')).resolves.toEqual(
      expect.objectContaining({ score: 0, state: 'NORMAL' }),
    )
  })
})
