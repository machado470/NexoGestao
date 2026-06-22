import { Injectable } from '@nestjs/common'
import { AppointmentStatus, ServiceOrderStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export type PeopleLoadStatus = 'IDLE' | 'NORMAL' | 'BUSY' | 'OVERLOADED'
export type PeopleCapacityStatus = 'UNDER_CAPACITY' | 'AT_CAPACITY' | 'OVER_CAPACITY'
export type PeopleAvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE_NOW' | 'UNAVAILABLE_SOON'
export type PeopleOperationalStatus = 'NORMAL' | 'ATENÇÃO' | 'RISCO' | 'CRÍTICO'
export type PeoplePriority = 'P0' | 'P1' | 'P2' | 'P3'

const OPEN_SERVICE_ORDER_STATUSES: ServiceOrderStatus[] = [
  ServiceOrderStatus.OPEN,
  ServiceOrderStatus.ASSIGNED,
  ServiceOrderStatus.IN_PROGRESS,
]

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
]

export function calculatePeopleLoadStatus(input: {
  openServiceOrdersCount: number
  overdueServiceOrdersCount: number
  futureAppointmentsCount: number
  todayAppointmentsCount: number
}): PeopleLoadStatus {
  if (input.overdueServiceOrdersCount > 0) return 'OVERLOADED'
  if (
    input.openServiceOrdersCount >= 8 ||
    input.futureAppointmentsCount >= 8 ||
    input.todayAppointmentsCount >= 5
  ) return 'OVERLOADED'
  if (input.openServiceOrdersCount === 0 && input.futureAppointmentsCount === 0) return 'IDLE'
  if (
    input.openServiceOrdersCount >= 5 ||
    input.futureAppointmentsCount >= 5 ||
    input.todayAppointmentsCount >= 3
  ) return 'BUSY'
  return 'NORMAL'
}

function calculateUsagePct(current: number, capacity: number | null): number | null {
  if (!capacity || capacity <= 0) return null
  return Math.round((current / capacity) * 100)
}

export function calculatePeopleAvailability(input: {
  exceptions: Array<{ id: string; startsAt: Date; endsAt: Date; reason: string | null }>
  now: Date
}) {
  const current = input.exceptions.find((exception) => exception.startsAt <= input.now && exception.endsAt > input.now) ?? null
  const next = input.exceptions.find((exception) => exception.startsAt > input.now) ?? null
  const soonUntil = new Date(input.now.getTime() + 48 * 60 * 60 * 1000)
  const availabilityStatus: PeopleAvailabilityStatus = current
    ? 'UNAVAILABLE_NOW'
    : next && next.startsAt <= soonUntil
      ? 'UNAVAILABLE_SOON'
      : 'AVAILABLE'
  const serialize = (exception: typeof current) => exception ? {
    id: exception.id,
    startsAt: exception.startsAt.toISOString(),
    endsAt: exception.endsAt.toISOString(),
    reason: exception.reason,
  } : null
  return {
    availabilityStatus,
    currentAvailabilityException: serialize(current),
    nextAvailabilityException: serialize(next),
  }
}

export function calculatePeopleCapacityStatus(input: {
  openServiceOrdersCount: number
  todayAppointmentsCount: number
  dailyServiceOrderCapacity: number | null
  dailyAppointmentCapacity: number | null
}): PeopleCapacityStatus {
  const { dailyServiceOrderCapacity, dailyAppointmentCapacity } = input
  if (!dailyServiceOrderCapacity || !dailyAppointmentCapacity) return 'AT_CAPACITY'
  if (
    input.openServiceOrdersCount > dailyServiceOrderCapacity ||
    input.todayAppointmentsCount > dailyAppointmentCapacity
  ) return 'OVER_CAPACITY'
  if (
    input.openServiceOrdersCount === dailyServiceOrderCapacity ||
    input.todayAppointmentsCount === dailyAppointmentCapacity
  ) return 'AT_CAPACITY'
  return 'UNDER_CAPACITY'
}

export function derivePeopleOperationalIntervention(input: {
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'INVITED'
  openServiceOrdersCount: number
  overdueServiceOrdersCount: number
  todayAppointmentsCount: number
  futureAppointmentsCount: number
  loadStatus: PeopleLoadStatus
  capacityStatus: PeopleCapacityStatus
  availabilityStatus: PeopleAvailabilityStatus
}): {
  operationalStatus: PeopleOperationalStatus
  priority: PeoplePriority
  interventionReason: string | null
  recommendedActionLabel: string | null
  recommendedActionTarget: 'PERSON' | 'SERVICE_ORDERS' | 'APPOINTMENTS' | 'TIMELINE' | null
} {
  const hasActiveLoad = input.openServiceOrdersCount > 0 || input.todayAppointmentsCount > 0 || input.futureAppointmentsCount > 0
  if ((input.status === 'INACTIVE' || input.status === 'SUSPENDED') && hasActiveLoad) {
    return {
      operationalStatus: 'CRÍTICO',
      priority: 'P0',
      interventionReason: 'Pessoa inativa ou suspensa mantém O.S. ou agendamentos ativos.',
      recommendedActionLabel: 'Revisar responsável',
      recommendedActionTarget: 'PERSON',
    }
  }
  if (input.overdueServiceOrdersCount > 0) {
    return {
      operationalStatus: 'RISCO',
      priority: 'P1',
      interventionReason: `${input.overdueServiceOrdersCount} O.S. atrasada(s) atribuída(s).`,
      recommendedActionLabel: 'Ver O.S. atrasadas',
      recommendedActionTarget: 'SERVICE_ORDERS',
    }
  }
  if (input.loadStatus === 'OVERLOADED' || input.capacityStatus === 'OVER_CAPACITY') {
    return {
      operationalStatus: 'RISCO',
      priority: 'P1',
      interventionReason: 'Carga atual acima da capacidade planejada.',
      recommendedActionLabel: 'Revisar atribuições',
      recommendedActionTarget: 'SERVICE_ORDERS',
    }
  }
  if (input.availabilityStatus === 'UNAVAILABLE_NOW') {
    return {
      operationalStatus: 'RISCO',
      priority: 'P2',
      interventionReason: 'Pessoa indisponível agora com impacto potencial na agenda.',
      recommendedActionLabel: 'Ver agenda',
      recommendedActionTarget: 'APPOINTMENTS',
    }
  }
  if (!hasActiveLoad) {
    return {
      operationalStatus: 'NORMAL',
      priority: 'P3',
      interventionReason: 'Sem carga ativa atribuída.',
      recommendedActionLabel: null,
      recommendedActionTarget: null,
    }
  }
  if (input.loadStatus === 'BUSY' || input.capacityStatus === 'AT_CAPACITY' || input.availabilityStatus === 'UNAVAILABLE_SOON') {
    return {
      operationalStatus: 'ATENÇÃO',
      priority: 'P2',
      interventionReason: 'Pessoa perto do limite operacional ou com indisponibilidade próxima.',
      recommendedActionLabel: 'Acompanhar capacidade',
      recommendedActionTarget: 'TIMELINE',
    }
  }
  return {
    operationalStatus: 'NORMAL',
    priority: 'P3',
    interventionReason: null,
    recommendedActionLabel: null,
    recommendedActionTarget: null,
  }
}

function buildOperationalSummaryText(input: { name: string; openServiceOrdersCount: number; todayAppointmentsCount: number; overdueServiceOrdersCount: number }) {
  if (input.openServiceOrdersCount === 0 && input.todayAppointmentsCount === 0) return `${input.name} está sem carga operacional ativa.`
  if (input.overdueServiceOrdersCount > 0) return `${input.name} executa ${input.openServiceOrdersCount} O.S. aberta(s), com ${input.overdueServiceOrdersCount} atraso(s).`
  return `${input.name} executa ${input.openServiceOrdersCount} O.S. aberta(s) e ${input.todayAppointmentsCount} agendamento(s) hoje.`
}

function buildCapacitySummaryText(input: { serviceOrderCapacityUsagePct: number | null; appointmentCapacityUsagePct: number | null; capacityStatus: PeopleCapacityStatus }) {
  if (input.serviceOrderCapacityUsagePct == null && input.appointmentCapacityUsagePct == null) return 'Capacidade diária não configurada; uso percentual indisponível.'
  return `Capacidade ${input.capacityStatus}: O.S. ${input.serviceOrderCapacityUsagePct ?? 'indisponível'}%, agenda ${input.appointmentCapacityUsagePct ?? 'indisponível'}%.`
}

function buildRiskSummaryText(input: { interventionReason: string | null; operationalStatus: PeopleOperationalStatus }) {
  return input.interventionReason ?? (input.operationalStatus === 'NORMAL' ? 'Nenhum risco operacional obrigatório identificado.' : 'Sinal operacional requer acompanhamento.')
}

@Injectable()
export class PeopleOperationalSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(orgId: string, now = new Date()) {
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const tomorrowStart = new Date(todayStart)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)

    const people = await this.prisma.person.findMany({
      where: { orgId },
      select: {
        id: true,
        name: true,
        role: true,
        active: true,
        dailyServiceOrderCapacity: true,
        dailyAppointmentCapacity: true,
        workloadNotes: true,
      },
      orderBy: { name: 'asc' },
    })
    const personIds = people.map((person) => person.id)

    if (personIds.length === 0) return { people: [] }

    const [serviceOrders, appointments, lastActivities, availabilityExceptions] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where: { orgId, assignedToPersonId: { in: personIds }, status: { in: OPEN_SERVICE_ORDER_STATUSES } },
        select: { assignedToPersonId: true, dueDate: true },
      }),
      this.prisma.appointment.findMany({
        where: { orgId, assignedToPersonId: { in: personIds }, status: { in: ACTIVE_APPOINTMENT_STATUSES }, startsAt: { gte: todayStart } },
        select: { assignedToPersonId: true, startsAt: true },
      }),
      this.prisma.timelineEvent.findMany({
        where: { orgId, personId: { in: personIds } },
        select: { personId: true, createdAt: true },
        distinct: ['personId'],
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.personAvailabilityException.findMany({
        where: { orgId, personId: { in: personIds }, endsAt: { gt: now } },
        select: { id: true, personId: true, startsAt: true, endsAt: true, reason: true },
        orderBy: { startsAt: 'asc' },
      }),
    ])

    const lastActivityByPersonId = new Map(lastActivities.flatMap((activity) => activity.personId
      ? [[activity.personId, activity.createdAt] as const]
      : []))

    return {
      people: people.map((person) => {
        const assignedServiceOrders = serviceOrders.filter((order) => order.assignedToPersonId === person.id)
        const assignedAppointments = appointments.filter((appointment) => appointment.assignedToPersonId === person.id)
        const overdueServiceOrdersCount = assignedServiceOrders.filter((order) => order.dueDate && order.dueDate < now).length
        const futureAppointmentsCount = assignedAppointments.filter((appointment) => appointment.startsAt > now).length
        const todayAppointmentsCount = assignedAppointments.filter((appointment) => appointment.startsAt >= todayStart && appointment.startsAt < tomorrowStart).length
        const load = { openServiceOrdersCount: assignedServiceOrders.length, overdueServiceOrdersCount, futureAppointmentsCount, todayAppointmentsCount }
        const loadStatus = calculatePeopleLoadStatus(load)
        const availability = calculatePeopleAvailability({
          exceptions: availabilityExceptions.filter((exception) => exception.personId === person.id),
          now,
        })
        const serviceOrderCapacityUsagePct = calculateUsagePct(load.openServiceOrdersCount, person.dailyServiceOrderCapacity)
        const appointmentCapacityUsagePct = calculateUsagePct(load.todayAppointmentsCount, person.dailyAppointmentCapacity)
        const capacityStatus = calculatePeopleCapacityStatus({
          openServiceOrdersCount: load.openServiceOrdersCount,
          todayAppointmentsCount: load.todayAppointmentsCount,
          dailyServiceOrderCapacity: person.dailyServiceOrderCapacity,
          dailyAppointmentCapacity: person.dailyAppointmentCapacity,
        })
        const capacity = {
          dailyServiceOrderCapacity: person.dailyServiceOrderCapacity,
          dailyAppointmentCapacity: person.dailyAppointmentCapacity,
          workloadNotes: person.workloadNotes,
          serviceOrderCapacityUsagePct,
          appointmentCapacityUsagePct,
          capacityStatus,
        }
        const status = person.active ? 'ACTIVE' : 'INACTIVE'
        const intervention = derivePeopleOperationalIntervention({ status, ...load, loadStatus, capacityStatus, availabilityStatus: availability.availabilityStatus })

        return {
          personId: person.id,
          name: person.name,
          role: person.role,
          status,
          ...load,
          ...capacity,
          ...availability,
          lastActivityAt: lastActivityByPersonId.get(person.id)?.toISOString() ?? null,
          loadStatus,
          ...intervention,
          operationalSummaryText: buildOperationalSummaryText({ name: person.name, ...load }),
          capacitySummaryText: buildCapacitySummaryText({ serviceOrderCapacityUsagePct, appointmentCapacityUsagePct, capacityStatus }),
          riskSummaryText: buildRiskSummaryText(intervention),
        }
      }),
    }
  }
}
