import { BadRequestException } from '@nestjs/common'
import { AppointmentStatus, ChargeStatus, ServiceOrderStatus } from '@prisma/client'

type TransitionMap<T extends string> = Record<T, T[]>

export const appointmentTransitions: TransitionMap<AppointmentStatus> = {
  SCHEDULED: ['CONFIRMED', 'CANCELED'],
  CONFIRMED: ['DONE', 'CANCELED', 'NO_SHOW'],
  CANCELED: [],
  NO_SHOW: [],
  DONE: [],
}

export const serviceOrderTransitions: TransitionMap<ServiceOrderStatus> = {
  OPEN: ['ASSIGNED', 'CANCELED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELED'],
  IN_PROGRESS: ['DONE', 'CANCELED'],
  DONE: [],
  CANCELED: [],
}

export const chargeTransitions: TransitionMap<ChargeStatus> = {
  PENDING: ['OVERDUE', 'PAID', 'CANCELED'],
  OVERDUE: ['PAID', 'CANCELED'],
  PAID: [],
  CANCELED: [],
}

export function ensureTransition<T extends string>(
  from: T,
  to: T,
  map: TransitionMap<T>,
  entity: string,
) {
  if (from === to) return
  const allowed = map[from] ?? []
  if (!allowed.includes(to)) {
    throw new BadRequestException({
      code: 'INVALID_STATE_TRANSITION',
      message: `Transição inválida para ${entity}: ${from} -> ${to}`,
      details: { entity, from, to, allowed },
    })
  }
}
