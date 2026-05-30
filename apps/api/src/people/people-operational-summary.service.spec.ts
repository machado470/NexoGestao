import { AppointmentStatus, ServiceOrderStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { calculatePeopleAvailability, calculatePeopleCapacityStatus, calculatePeopleLoadStatus, PeopleOperationalSummaryService } from './people-operational-summary.service'

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
    }))
    expect(result.people[1]).toEqual(expect.objectContaining({ personId: 'person-idle', loadStatus: 'IDLE' }))
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
})
