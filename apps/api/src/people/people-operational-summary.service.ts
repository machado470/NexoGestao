import { Injectable } from '@nestjs/common'
import { AppointmentStatus, ServiceOrderStatus } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export type PeopleLoadStatus = 'IDLE' | 'NORMAL' | 'BUSY' | 'OVERLOADED'
export type PeopleCapacityStatus = 'UNDER_CAPACITY' | 'AT_CAPACITY' | 'OVER_CAPACITY'

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

    const [serviceOrders, appointments, lastActivities] = await Promise.all([
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
        const capacity = {
          dailyServiceOrderCapacity: person.dailyServiceOrderCapacity,
          dailyAppointmentCapacity: person.dailyAppointmentCapacity,
          workloadNotes: person.workloadNotes,
          serviceOrderCapacityUsagePct: calculateUsagePct(load.openServiceOrdersCount, person.dailyServiceOrderCapacity),
          appointmentCapacityUsagePct: calculateUsagePct(load.todayAppointmentsCount, person.dailyAppointmentCapacity),
          capacityStatus: calculatePeopleCapacityStatus({
            openServiceOrdersCount: load.openServiceOrdersCount,
            todayAppointmentsCount: load.todayAppointmentsCount,
            dailyServiceOrderCapacity: person.dailyServiceOrderCapacity,
            dailyAppointmentCapacity: person.dailyAppointmentCapacity,
          }),
        }

        return {
          personId: person.id,
          name: person.name,
          role: person.role,
          status: person.active ? 'ACTIVE' : 'INACTIVE',
          ...load,
          ...capacity,
          lastActivityAt: lastActivityByPersonId.get(person.id)?.toISOString() ?? null,
          loadStatus: calculatePeopleLoadStatus(load),
        }
      }),
    }
  }
}
