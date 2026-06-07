import { TemporalRiskService } from './temporal-risk.service'

function buildPrisma() {
  return {
    person: { findFirst: jest.fn() },
    correctiveAction: { count: jest.fn() },
    assignment: { findMany: jest.fn() },
    charge: { count: jest.fn(), aggregate: jest.fn() },
    payment: { count: jest.fn() },
    serviceOrder: { count: jest.fn(), findFirst: jest.fn() },
    appointment: { count: jest.fn(), findFirst: jest.fn() },
    timelineEvent: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    whatsAppConversation: { count: jest.fn() },
  } as any
}

describe('TemporalRiskService operational signals', () => {
  let prisma: ReturnType<typeof buildPrisma>
  let service: TemporalRiskService

  beforeEach(() => {
    jest.clearAllMocks()
    prisma = buildPrisma()
    prisma.person.findFirst.mockResolvedValue({
      id: 'p1',
      orgId: 'org-a',
      dailyServiceOrderCapacity: 5,
      dailyAppointmentCapacity: 5,
      updatedAt: new Date(),
    })
    prisma.correctiveAction.count.mockResolvedValue(0)
    prisma.assignment.findMany.mockResolvedValue([])
    prisma.charge.count.mockResolvedValue(0)
    prisma.charge.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } })
    prisma.payment.count.mockResolvedValue(0)
    prisma.serviceOrder.count.mockResolvedValue(0)
    prisma.serviceOrder.findFirst.mockResolvedValue(null)
    prisma.appointment.count.mockResolvedValue(0)
    prisma.appointment.findFirst.mockResolvedValue(null)
    prisma.timelineEvent.count.mockResolvedValue(0)
    prisma.timelineEvent.findMany.mockResolvedValue([])
    prisma.timelineEvent.findFirst.mockResolvedValue(null)
    prisma.whatsAppConversation.count.mockResolvedValue(0)
    service = new TemporalRiskService(prisma)
  })

  it('calculates WARNING/RESTRICTED with overdue service orders and keeps org scope', async () => {
    prisma.serviceOrder.count.mockImplementation(({ where }: any) => {
      if (where.dueDate?.lt) return 2
      return 0
    })

    const result = await service.calculateDetailed('p1', 'org-a')

    expect(result.state).toBe('WARNING')
    expect(result.contributors).toContain('OVERDUE_SERVICE_ORDERS')
    expect(prisma.person.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', orgId: 'org-a' } }),
    )
    expect(prisma.serviceOrder.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ orgId: 'org-a', assignedToPersonId: 'p1' }),
      }),
    )
  })

  it('accepts canonical MESSAGE_FAILED and legacy aliases from timeline events', async () => {
    prisma.timelineEvent.count.mockResolvedValue(2)
    prisma.timelineEvent.findMany.mockResolvedValue([
      { action: 'MESSAGE_FAILED' },
      { action: 'WHATSAPP_MESSAGE_FAILED' },
    ])

    const result = await service.calculateDetailed('p1', 'org-a')

    expect(result.contributors).toEqual(
      expect.arrayContaining(['MESSAGE_FAILURES', 'CANONICAL_CRITICAL_TIMELINE_EVENTS']),
    )
    expect(result.factors.failedMessages).toBe(2)
  })

  it('does not query operational signals across tenants when orgId is omitted', async () => {
    await service.calculateDetailed('p1')

    expect(prisma.person.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' } }),
    )
    expect(prisma.charge.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-a' }) }),
    )
    expect(prisma.appointment.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-a' }) }),
    )
    expect(prisma.timelineEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-a', personId: 'p1' }) }),
    )
  })
})
