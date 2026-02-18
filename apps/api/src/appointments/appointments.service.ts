import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AppointmentStatus } from '@prisma/client'

const DEFAULT_DURATION_MIN = 30

function parseISODate(label: string, v?: string): Date | null {
  const s = (v ?? '').trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`${label} inválido (use ISO)`)
  }
  return d
}

function normalizeNotes(v?: string): string | null {
  const s = (v ?? '').trim()
  return s ? s : null
}

function isStatus(v: any): v is AppointmentStatus {
  return (
    v === 'SCHEDULED' ||
    v === 'CONFIRMED' ||
    v === 'CANCELED' ||
    v === 'DONE' ||
    v === 'NO_SHOW'
  )
}

function statusToAction(status: AppointmentStatus): string {
  switch (status) {
    case 'CONFIRMED':
      return 'APPOINTMENT_CONFIRMED'
    case 'CANCELED':
      return 'APPOINTMENT_CANCELED'
    case 'DONE':
      return 'APPOINTMENT_DONE'
    case 'NO_SHOW':
      return 'APPOINTMENT_NO_SHOW'
    case 'SCHEDULED':
    default:
      return 'APPOINTMENT_UPDATED'
  }
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60 * 1000)
}

function durationMinutes(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime()
  if (ms <= 0) return DEFAULT_DURATION_MIN
  return Math.max(1, Math.round(ms / 60000))
}

function isOverlapDbViolation(err: any): boolean {
  const msg = String(err?.message ?? '')
  const code = String(err?.code ?? '')
  // Postgres exclusion_violation = 23P01
  return (
    code === '23P01' ||
    msg.includes('Appointment_no_overlap_per_org') ||
    msg.toLowerCase().includes('exclusion') ||
    msg.toLowerCase().includes('overlap')
  )
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  async list(
    orgId: string,
    filters: {
      from?: string
      to?: string
      status?: AppointmentStatus
      customerId?: string
    },
  ) {
    if (!orgId) throw new BadRequestException('orgId é obrigatório')

    const from = parseISODate('from', filters.from)
    const to = parseISODate('to', filters.to)

    const where: any = { orgId }

    if (filters.customerId) where.customerId = filters.customerId

    if (filters.status != null) {
      if (!isStatus(filters.status)) throw new BadRequestException('status inválido')
      where.status = filters.status
    }

    if (from || to) {
      where.startsAt = {}
      if (from) where.startsAt.gte = from
      if (to) where.startsAt.lte = to
    }

    return this.prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      take: 500,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    })
  }

  async get(orgId: string, id: string) {
    if (!orgId) throw new BadRequestException('orgId é obrigatório')
    if (!id) throw new BadRequestException('id é obrigatório')

    const appt = await this.prisma.appointment.findFirst({
      where: { id, orgId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
      },
    })
    if (!appt) throw new NotFoundException('Agendamento não encontrado')
    return appt
  }

  async create(params: {
    orgId: string
    createdBy: string | null
    customerId: string
    startsAt: string
    endsAt?: string
    status?: AppointmentStatus
    notes?: string
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!params.customerId) throw new BadRequestException('customerId é obrigatório')

    const startsAt = parseISODate('startsAt', params.startsAt)
    if (!startsAt) throw new BadRequestException('startsAt é obrigatório')

    const endsAtParsed = parseISODate('endsAt', params.endsAt)
    const endsAt = endsAtParsed ?? addMinutes(startsAt, DEFAULT_DURATION_MIN)

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('endsAt não pode ser antes/igual a startsAt')
    }

    let status: AppointmentStatus = 'SCHEDULED'
    if (params.status != null) {
      if (!isStatus(params.status)) throw new BadRequestException('status inválido')
      status = params.status
    }

    const notes = normalizeNotes(params.notes)

    const customer = await this.prisma.customer.findFirst({
      where: { id: params.customerId, orgId: params.orgId },
      select: { id: true, name: true },
    })
    if (!customer) throw new BadRequestException('Cliente inválido para este org')

    try {
      const created = await this.prisma.appointment.create({
        data: {
          orgId: params.orgId,
          customerId: params.customerId,
          startsAt,
          endsAt,
          status,
          notes,
        },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
      })

      await this.timeline.log({
        orgId: params.orgId,
        action: 'APPOINTMENT_CREATED',
        description: `Agendamento criado: ${created.customer.name}`,
        metadata: {
          appointmentId: created.id,
          customerId: created.customerId,
          createdBy: params.createdBy,
          startsAt: created.startsAt,
          endsAt: created.endsAt,
          status: created.status,
        },
      })

      return created
    } catch (e: any) {
      if (isOverlapDbViolation(e)) {
        await this.timeline.log({
          orgId: params.orgId,
          action: 'APPOINTMENT_CONFLICT_BLOCKED',
          description: `Conflito de horário bloqueado (DB) (cliente: ${customer.name})`,
          metadata: {
            customerId: params.customerId,
            attempted: { startsAt, endsAt, status },
            createdBy: params.createdBy,
          },
        })
        throw new ConflictException('Conflito de horário: já existe um agendamento nesse intervalo')
      }
      throw e
    }
  }

  async update(params: {
    orgId: string
    updatedBy: string | null
    id: string
    data: {
      startsAt?: string
      endsAt?: string
      status?: AppointmentStatus
      notes?: string
    }
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!params.id) throw new BadRequestException('id é obrigatório')

    const existing = await this.prisma.appointment.findFirst({
      where: { id: params.id, orgId: params.orgId },
      select: {
        id: true,
        status: true,
        startsAt: true,
        endsAt: true,
        customerId: true,
      },
    })
    if (!existing) throw new NotFoundException('Agendamento não encontrado')

    const patch: any = {}

    const patchStartsAt =
      typeof params.data.startsAt === 'string'
        ? parseISODate('startsAt', params.data.startsAt)
        : undefined

    const patchEndsAt =
      typeof params.data.endsAt === 'string'
        ? parseISODate('endsAt', params.data.endsAt)
        : undefined

    if (patchStartsAt === null) throw new BadRequestException('startsAt inválido')
    if (patchEndsAt === null) throw new BadRequestException('endsAt inválido')

    if (typeof params.data.notes === 'string') {
      patch.notes = normalizeNotes(params.data.notes)
    }

    if (typeof params.data.status === 'string') {
      if (!isStatus(params.data.status)) throw new BadRequestException('status inválido')
      patch.status = params.data.status
    }

    const finalStartsAt = (patchStartsAt ?? existing.startsAt) as Date

    const existingEndsAt = existing.endsAt as Date
    const existingDuration = durationMinutes(existing.startsAt, existingEndsAt)

    const finalEndsAt =
      patchEndsAt !== undefined
        ? (patchEndsAt ?? addMinutes(finalStartsAt, DEFAULT_DURATION_MIN))
        : patchStartsAt
          ? addMinutes(finalStartsAt, existingDuration)
          : existingEndsAt

    if (finalEndsAt.getTime() <= finalStartsAt.getTime()) {
      throw new BadRequestException('endsAt não pode ser antes/igual a startsAt')
    }

    patch.startsAt = finalStartsAt
    patch.endsAt = finalEndsAt

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar')
    }

    try {
      const result = await this.prisma.appointment.updateMany({
        where: { id: params.id, orgId: params.orgId },
        data: patch,
      })
      if (result.count === 0) throw new NotFoundException('Agendamento não encontrado')

      const updated = await this.prisma.appointment.findFirst({
        where: { id: params.id, orgId: params.orgId },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
      })
      if (!updated) throw new NotFoundException('Agendamento não encontrado')

      const statusChanged = patch.status && patch.status !== existing.status

      await this.timeline.log({
        orgId: params.orgId,
        action: statusChanged ? statusToAction(updated.status) : 'APPOINTMENT_UPDATED',
        description: `Agendamento atualizado: ${updated.customer.name}`,
        metadata: {
          appointmentId: updated.id,
          customerId: updated.customerId,
          updatedBy: params.updatedBy,
          patch,
        },
      })

      return updated
    } catch (e: any) {
      if (isOverlapDbViolation(e)) {
        await this.timeline.log({
          orgId: params.orgId,
          action: 'APPOINTMENT_CONFLICT_BLOCKED',
          description: `Conflito de horário bloqueado (DB) (update)`,
          metadata: {
            appointmentId: params.id,
            attempted: { startsAt: finalStartsAt, endsAt: finalEndsAt, status: patch.status },
            updatedBy: params.updatedBy,
          },
        })
        throw new ConflictException('Conflito de horário: já existe um agendamento nesse intervalo')
      }
      throw e
    }
  }
}
