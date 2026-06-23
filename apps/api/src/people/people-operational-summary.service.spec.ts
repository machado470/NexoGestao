import { AppointmentStatus, ServiceOrderStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { calculatePeopleAvailability, calculatePeopleCapacityStatus, calculatePeopleLoadStatus, derivePeopleOperationalIntervention, PeopleOperationalSummaryService } from './people-operational-summary.service'

const mockPrisma = {
  person: { findMany: jest.fn() },
  serviceOrder: { findMany: jest.fn() },
  appointment: { findMany: jest.fn() },
  timelineEvent: { findMany: jest.fn() },
  personAvailabilityException: { findMany: jest.fn() },
}

describe('PeopleOperationalSummaryService', () => {
  const now = new Date('2026-05-30T12:00:00.000Z')
  const service = new PeopleOperationalSummaryService(mockPrisma as unknown as PrismaService)

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.person.findMany.mockResolvedValue([
      { id: 'person-1', name: 'Ana', role: 'TECH', active: true, dailyServiceOrderCapacity: 5, dailyAppointmentCapacity: 2, workloadNotes: 'Campo externo' },
      { id: 'person-idle', name: 'Bia', role: 'TECH', active: true, dailyServiceOrderCapacity: 5, dailyAppointmentCapacity: 5, workloadNotes: null },
    ])
    mockPrisma.serviceOrder.findMany.mockResolvedValue([])
    mockPrisma.appointment.findMany.mockResolvedValue([])
    mockPrisma.timelineEvent.findMany.mockResolvedValue([])
    mockPrisma.personAvailabilityException.findMany.mockResolvedValue([])
  })

  it('conta O.S. abertas, atrasadas e agenda futura/de hoje por responsável real', async () => {
    mockPrisma.serviceOrder.findMany.mockResolvedValue([
      { assignedToPersonId: 'person-1', dueDate: new Date('2026-05-29T12:00:00.000Z') },
      { assignedToPersonId: 'person-1', dueDate: new Date('2026-06-01T12:00:00.000Z') },
    ])
    mockPrisma.appointment.findMany.mockResolvedValue([
      { assignedToPersonId: 'person-1', startsAt: new Date('2026-05-30T10:00:00.000Z') },
      { assignedToPersonId: 'person-1', startsAt: new Date('2026-05-30T14:00:00.000Z') },
      { assignedToPersonId: 'person-1', startsAt: new Date('2026-06-01T14:00:00.000Z') },
    ])

    const result = await service.getSummary('org-trusted', now)

    expect(result.people[0]).toEqual(expect.objectContaining({
      personId: 'person-1',
      openServiceOrdersCount: 2,
      overdueServiceOrdersCount: 1,
      futureAppointmentsCount: 2,
      todayAppointmentsCount: 2,
      loadStatus: 'OVERLOADED',
      dailyServiceOrderCapacity: 5,
      dailyAppointmentCapacity: 2,
      workloadNotes: 'Campo externo',
      serviceOrderCapacityUsagePct: 40,
      appointmentCapacityUsagePct: 100,
      capacityStatus: 'AT_CAPACITY',
      operationalStatus: 'RISCO',
      priority: 'P1',
      interventionReason: '1 O.S. atrasada(s) atribuída(s).',
      recommendedActionLabel: 'Ver O.S. atrasadas',
      recommendedActionTarget: 'SERVICE_ORDERS',
      operationalSummaryText: 'Ana executa 2 O.S. aberta(s), com 1 atraso(s).',
      capacitySummaryText: 'Capacidade AT_CAPACITY: O.S. 40%, agenda 100%.',
      riskSummaryText: '1 O.S. atrasada(s) atribuída(s).',
    }))
    expect(result.people[1]).toEqual(expect.objectContaining({
      personId: 'person-idle',
      loadStatus: 'IDLE',
      operationalStatus: 'NORMAL',
      priority: 'P3',
      interventionReason: 'Sem carga ativa atribuída.',
    }))
  })

  it('isola todas as consultas pelo tenant recebido do contexto autenticado', async () => {
    await service.getSummary('org-trusted', now)

    expect(mockPrisma.person.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: 'org-trusted' } }))
    expect(mockPrisma.serviceOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-trusted', assignedToPersonId: { in: ['person-1', 'person-idle'] }, status: { in: [ServiceOrderStatus.OPEN, ServiceOrderStatus.ASSIGNED, ServiceOrderStatus.IN_PROGRESS] } }) }))
    expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-trusted', assignedToPersonId: { in: ['person-1', 'person-idle'] }, status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] } }) }))
    expect(mockPrisma.timelineEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-trusted' }) }))
    expect(mockPrisma.personAvailabilityException.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-trusted' }) }))
  })

  it('usa timeline tenant-scoped como fonte confiável da última atividade', async () => {
    mockPrisma.timelineEvent.findMany.mockResolvedValue([{ personId: 'person-1', createdAt: new Date('2026-05-30T10:00:00.000Z') }])

    const result = await service.getSummary('org-trusted', now)

    expect(result.people[0].lastActivityAt).toBe('2026-05-30T10:00:00.000Z')
    expect(result.people[1].lastActivityAt).toBeNull()
  })

  it.each([
    [{ id: 'now', personId: 'person-1', startsAt: new Date('2026-05-30T11:00:00.000Z'), endsAt: new Date('2026-05-30T13:00:00.000Z'), reason: 'Consulta' }, 'UNAVAILABLE_NOW'],
    [{ id: 'soon', personId: 'person-1', startsAt: new Date('2026-06-01T11:00:00.000Z'), endsAt: new Date('2026-06-01T13:00:00.000Z'), reason: null }, 'UNAVAILABLE_SOON'],
    [null, 'AVAILABLE'],
  ])('retorna disponibilidade no operational-summary: %p -> %s', async (exception, expected) => {
    mockPrisma.personAvailabilityException.findMany.mockResolvedValue(exception ? [exception] : [])
    const result = await service.getSummary('org-trusted', now)
    expect(result.people[0].availabilityStatus).toBe(expected)
  })

  it.each([
    [[{ id: 'now', startsAt: new Date('2026-05-30T11:00:00.000Z'), endsAt: new Date('2026-05-30T13:00:00.000Z'), reason: null }], 'UNAVAILABLE_NOW'],
    [[{ id: 'soon', startsAt: new Date('2026-06-01T11:00:00.000Z'), endsAt: new Date('2026-06-01T13:00:00.000Z'), reason: null }], 'UNAVAILABLE_SOON'],
    [[{ id: 'later', startsAt: new Date('2026-06-03T12:00:00.000Z'), endsAt: new Date('2026-06-03T13:00:00.000Z'), reason: null }], 'AVAILABLE'],
    [[], 'AVAILABLE'],
  ])('classifica disponibilidade temporária sem alterar capacidade: %p -> %s', (exceptions, expected) => {
    expect(calculatePeopleAvailability({ exceptions, now }).availabilityStatus).toBe(expected)
  })


  it('retorna blocos opcionais auditáveis sem misturar pessoa, com limites e nulls honestos', async () => {
    mockPrisma.person.findMany.mockResolvedValue([
      { id: 'person-1', name: 'Ana', role: 'TECH', active: true, dailyServiceOrderCapacity: 5, dailyAppointmentCapacity: 5, workloadNotes: null, riskScore: 7, operationalRiskScore: 12, operationalState: 'WARNING' },
      { id: 'person-2', name: 'Bia', role: 'TECH', active: true, dailyServiceOrderCapacity: 5, dailyAppointmentCapacity: 5, workloadNotes: null, riskScore: 0, operationalRiskScore: 0, operationalState: 'NORMAL' },
    ])
    mockPrisma.serviceOrder.findMany
      .mockResolvedValueOnce([{ assignedToPersonId: 'person-1', dueDate: new Date('2026-05-29T12:00:00.000Z'), customerId: 'cust-1' }])
      .mockResolvedValueOnce([
        { assignedToPersonId: 'person-1', status: ServiceOrderStatus.DONE, startedAt: new Date('2026-05-30T10:00:00.000Z'), finishedAt: new Date('2026-05-30T11:00:00.000Z'), customerId: 'cust-1' },
        { assignedToPersonId: 'person-1', status: ServiceOrderStatus.DONE, startedAt: null, finishedAt: new Date('2026-05-30T12:00:00.000Z'), customerId: 'cust-2' },
        { assignedToPersonId: 'person-1', status: ServiceOrderStatus.CANCELED, startedAt: null, finishedAt: null, customerId: 'cust-3' },
      ])
      .mockResolvedValueOnce([
        { id: 'so-1', assignedToPersonId: 'person-1', status: ServiceOrderStatus.DONE, dueDate: null, finishedAt: new Date('2026-05-30T11:00:00.000Z'), customer: { name: 'Cliente A' } },
        { id: 'so-2', assignedToPersonId: 'person-1', status: ServiceOrderStatus.CANCELED, dueDate: null, finishedAt: null, customer: { name: 'Cliente B' } },
        { id: 'so-3', assignedToPersonId: 'person-1', status: ServiceOrderStatus.OPEN, dueDate: null, finishedAt: null, customer: { name: 'Cliente C' } },
        { id: 'so-4', assignedToPersonId: 'person-1', status: ServiceOrderStatus.OPEN, dueDate: null, finishedAt: null, customer: { name: 'Cliente D' } },
      ])
    mockPrisma.appointment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'appt-1', assignedToPersonId: 'person-1', startsAt: new Date('2026-05-30T13:00:00.000Z'), status: AppointmentStatus.SCHEDULED, customer: { name: 'Cliente A' } },
        { id: 'appt-2', assignedToPersonId: 'person-1', startsAt: new Date('2026-05-30T14:00:00.000Z'), status: AppointmentStatus.CONFIRMED, customer: { name: 'Cliente B' } },
        { id: 'appt-3', assignedToPersonId: 'person-1', startsAt: new Date('2026-05-30T15:00:00.000Z'), status: AppointmentStatus.SCHEDULED, customer: { name: 'Cliente C' } },
        { id: 'appt-4', assignedToPersonId: 'person-1', startsAt: new Date('2026-05-30T16:00:00.000Z'), status: AppointmentStatus.SCHEDULED, customer: { name: 'Cliente D' } },
      ])
    mockPrisma.timelineEvent.findMany.mockResolvedValue([
      { id: 'evt-1', personId: 'person-1', action: 'SERVICE_ORDER_COMPLETED', description: 'O.S. concluída', customerId: null, serviceOrderId: 'so-1', appointmentId: null, chargeId: null, createdAt: new Date('2026-05-30T11:00:00.000Z') },
      { id: 'evt-other', personId: 'person-2', action: 'APPOINTMENT_CONFIRMED', description: 'Outro', customerId: null, serviceOrderId: null, appointmentId: 'appt-x', chargeId: null, createdAt: new Date('2026-05-30T12:00:00.000Z') },
    ])

    const result = await service.getSummary('org-trusted', now)
    const ana = result.people[0]
    const bia = result.people[1]

    expect(ana.customers).toEqual({ activeCustomersCount: 3, attendedCustomersCount: 2, customersWithOpenServiceOrdersCount: 1, customersWithOverdueServiceOrdersCount: 1 })
    expect(ana.appointments.nextAppointments).toHaveLength(3)
    expect(ana.appointments.conflictsCount).toBeNull()
    expect(ana.serviceOrders).toEqual(expect.objectContaining({ completedServiceOrdersCount: 2, averageCompletionMinutes: 60, completionRatePct: 67 }))
    expect(ana.serviceOrders.recentServiceOrders).toHaveLength(3)
    expect(ana.timeline.lastEvents).toEqual([expect.objectContaining({ id: 'evt-1', entityType: 'SERVICE_ORDER', entityId: 'so-1' })])
    expect(ana.risk).toEqual(expect.objectContaining({ riskScore: 7, operationalRiskScore: 12, operationalState: 'WARNING', riskTrend: null }))
    expect(bia.timeline.lastEvents).toEqual([expect.objectContaining({ id: 'evt-other' })])
    expect(bia.serviceOrders.completionRatePct).toBeNull()
  })

  it.each([
    [{ openServiceOrdersCount: 2, todayAppointmentsCount: 1, dailyServiceOrderCapacity: 5, dailyAppointmentCapacity: 5 }, 'UNDER_CAPACITY'],
    [{ openServiceOrdersCount: 5, todayAppointmentsCount: 1, dailyServiceOrderCapacity: 5, dailyAppointmentCapacity: 5 }, 'AT_CAPACITY'],
    [{ openServiceOrdersCount: 6, todayAppointmentsCount: 1, dailyServiceOrderCapacity: 5, dailyAppointmentCapacity: 5 }, 'OVER_CAPACITY'],
    [{ openServiceOrdersCount: 0, todayAppointmentsCount: 0, dailyServiceOrderCapacity: null, dailyAppointmentCapacity: 5 }, 'AT_CAPACITY'],
  ])('compara carga atual com capacidade planejada: %p -> %s', (input, expected) => {
    expect(calculatePeopleCapacityStatus(input)).toBe(expected)
  })

  it.each([
    [{ openServiceOrdersCount: 0, overdueServiceOrdersCount: 0, futureAppointmentsCount: 0, todayAppointmentsCount: 0 }, 'IDLE'],
    [{ openServiceOrdersCount: 1, overdueServiceOrdersCount: 0, futureAppointmentsCount: 1, todayAppointmentsCount: 1 }, 'NORMAL'],
    [{ openServiceOrdersCount: 5, overdueServiceOrdersCount: 0, futureAppointmentsCount: 1, todayAppointmentsCount: 1 }, 'BUSY'],
    [{ openServiceOrdersCount: 1, overdueServiceOrdersCount: 1, futureAppointmentsCount: 1, todayAppointmentsCount: 1 }, 'OVERLOADED'],
  ])('classifica carga simples e transparente: %p -> %s', (input, expected) => {
    expect(calculatePeopleLoadStatus(input)).toBe(expected)
  })

  it('não quebra quando capacidade é null e mantém percentual indisponível', async () => {
    mockPrisma.person.findMany.mockResolvedValue([
      { id: 'person-null', name: 'Caio', role: 'TECH', active: true, dailyServiceOrderCapacity: null, dailyAppointmentCapacity: null, workloadNotes: null },
    ])

    const result = await service.getSummary('org-trusted', now)

    expect(result.people[0]).toEqual(expect.objectContaining({
      personId: 'person-null',
      serviceOrderCapacityUsagePct: null,
      appointmentCapacityUsagePct: null,
      capacityStatus: 'AT_CAPACITY',
      capacitySummaryText: 'Capacidade diária não configurada; uso percentual indisponível.',
    }))
  })

  it.each([
    [{ status: 'INACTIVE', openServiceOrdersCount: 1, overdueServiceOrdersCount: 0, todayAppointmentsCount: 0, futureAppointmentsCount: 0, loadStatus: 'NORMAL', capacityStatus: 'UNDER_CAPACITY', availabilityStatus: 'AVAILABLE' }, 'CRÍTICO', 'P0'],
    [{ status: 'ACTIVE', openServiceOrdersCount: 1, overdueServiceOrdersCount: 1, todayAppointmentsCount: 0, futureAppointmentsCount: 0, loadStatus: 'OVERLOADED', capacityStatus: 'UNDER_CAPACITY', availabilityStatus: 'AVAILABLE' }, 'RISCO', 'P1'],
    [{ status: 'ACTIVE', openServiceOrdersCount: 1, overdueServiceOrdersCount: 0, todayAppointmentsCount: 0, futureAppointmentsCount: 0, loadStatus: 'NORMAL', capacityStatus: 'OVER_CAPACITY', availabilityStatus: 'AVAILABLE' }, 'RISCO', 'P1'],
    [{ status: 'ACTIVE', openServiceOrdersCount: 1, overdueServiceOrdersCount: 0, todayAppointmentsCount: 0, futureAppointmentsCount: 0, loadStatus: 'NORMAL', capacityStatus: 'UNDER_CAPACITY', availabilityStatus: 'UNAVAILABLE_NOW' }, 'RISCO', 'P2'],
    [{ status: 'ACTIVE', openServiceOrdersCount: 0, overdueServiceOrdersCount: 0, todayAppointmentsCount: 0, futureAppointmentsCount: 0, loadStatus: 'IDLE', capacityStatus: 'UNDER_CAPACITY', availabilityStatus: 'AVAILABLE' }, 'NORMAL', 'P3'],
  ] as const)('retorna operationalStatus e priority do backend: %p', (input, operationalStatus, priority) => {
    expect(derivePeopleOperationalIntervention(input)).toEqual(expect.objectContaining({ operationalStatus, priority }))
  })
})
