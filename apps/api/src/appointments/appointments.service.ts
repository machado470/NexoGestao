import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { AppointmentStatus, Prisma } from '@prisma/client'
import { WhatsAppService } from '../whatsapp/whatsapp.service'
import { RiskService } from '../risk/risk.service'
import { AutomationService } from '../automation/automation.service'

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
    private readonly audit: AuditService,
    private readonly whatsapp: WhatsAppService,
    private readonly risk: RiskService,
    private readonly automation: AutomationService,
  ) {}

  private canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
    const allowed: Record<AppointmentStatus, AppointmentStatus[]> = {
      SCHEDULED: ['CONFIRMED', 'CANCELED', 'NO_SHOW', 'DONE'],
      CONFIRMED: ['CANCELED', 'NO_SHOW', 'DONE'],
      CANCELED: [],
      NO_SHOW: [],
      DONE: [],
    }
    return from === to || allowed[from].includes(to)
  }

  private async enqueueAppointmentWorkflow(params: {
    orgId: string
    customerId: string
    appointmentId: string
    status: AppointmentStatus
  }) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: params.customerId, orgId: params.orgId },
      select: { id: true, phone: true },
    })
    if (!customer?.phone) return

    const messageTypeByStatus: Partial<Record<AppointmentStatus, any>> = {
      CONFIRMED: 'APPOINTMENT_CONFIRMATION',
      NO_SHOW: 'REMIND_24H',
    }
    const messageType = messageTypeByStatus[params.status]
    if (!messageType) return

    await this.whatsapp.queueMessage({
      orgId: params.orgId,
      customerId: customer.id,
      toPhone: customer.phone,
      entityType: 'APPOINTMENT',
      entityId: params.appointmentId,
      messageType,
      messageKey: `appointment:${params.appointmentId}:${params.status}`,
      renderedText:
        params.status === 'CONFIRMED'
          ? 'Seu agendamento foi confirmado ✅'
          : 'Identificamos ausência no agendamento. Deseja reagendar?',
    })
  }

  async list(
    orgId: string,
    filters: {
      from?: string
      to?: string
      status?: AppointmentStatus
      customerId?: string
      page?: number
      limit?: number
      search?: string
    },
  ) {
    if (!orgId) throw new BadRequestException('orgId é obrigatório')
    const from = parseISODate('from', filters.from)
    const to = parseISODate('to', filters.to)

    const page = Number(filters.page) || 1
    const limit = Number(filters.limit) || 20
    const skip = (page - 1) * limit

    const where: Prisma.AppointmentWhereInput = { orgId }

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

    if (filters.search) {
      const s = String(filters.search)
      where.OR = [
        { notes: { contains: s, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { name: { contains: s, mode: 'insensitive' } },
              { email: { contains: s, mode: 'insensitive' } },
              { phone: { contains: s, mode: 'insensitive' } },
            ],
          },
        },
      ]
    }

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy: { startsAt: 'asc' },
        take: limit,
        skip,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
      }),
      this.prisma.appointment.count({ where }),
    ])

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
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
    personId: string | null
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
      }) as any

      const context = `Agendamento criado: ${created.customer.name}`

      await this.timeline.log({
        orgId: params.orgId,
        personId: params.personId,
        action: 'APPOINTMENT_CREATED',
        description: context,
        metadata: {
          appointmentId: created.id,
          customerId: created.customerId,
          actorUserId: params.createdBy,
          actorPersonId: params.personId,
          createdBy: params.createdBy,
          startsAt: created.startsAt,
          endsAt: created.endsAt,
          status: created.status,
        },
      })

      await this.automation.executeTrigger({
        orgId: params.orgId,
        trigger: 'APPOINTMENT_CREATED',
        payload: {
          appointmentId: created.id,
          customerId: created.customerId,
          customerPhone: created.customer?.phone ?? null,
          startsAt: created.startsAt,
          status: created.status,
          entityId: created.id,
        },
      })

      await this.audit.log({
        orgId: params.orgId,
        action: AUDIT_ACTIONS.APPOINTMENT_CREATED,
        actorUserId: params.createdBy,
        actorPersonId: params.personId,
        personId: params.personId,
        entityType: 'APPOINTMENT',
        entityId: created.id,
        context,
        metadata: {
          appointmentId: created.id,
          customerId: created.customerId,
          startsAt: created.startsAt,
          endsAt: created.endsAt,
          status: created.status,
          notes: created.notes,
        },
      })

      return created
    } catch (e: any) {
      if (isOverlapDbViolation(e)) {
        const context = `Conflito de horário bloqueado (DB) (cliente: ${customer.name})`

        await this.timeline.log({
          orgId: params.orgId,
          personId: params.personId,
          action: 'APPOINTMENT_CONFLICT_BLOCKED',
          description: context,
          metadata: {
            customerId: params.customerId,
            actorUserId: params.createdBy,
            actorPersonId: params.personId,
            createdBy: params.createdBy,
            attempted: { startsAt, endsAt, status },
          },
        })

        await this.audit.log({
          orgId: params.orgId,
          action: AUDIT_ACTIONS.APPOINTMENT_CONFLICT_BLOCKED,
          actorUserId: params.createdBy,
          actorPersonId: params.personId,
          personId: params.personId,
          entityType: 'APPOINTMENT',
          entityId: null,
          context,
          metadata: {
            customerId: params.customerId,
            attempted: { startsAt, endsAt, status },
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
    personId: string | null
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

    const before = await this.prisma.appointment.findFirst({
      where: { id: params.id, orgId: params.orgId },
      include: {
        customer: { select: { id: true, name: true } },
      },
    })
    if (!before) throw new NotFoundException('Agendamento não encontrado')

    const data: any = {}

    if (params.data.startsAt) {
      data.startsAt = parseISODate('startsAt', params.data.startsAt)
    }
    if (params.data.endsAt) {
      data.endsAt = parseISODate('endsAt', params.data.endsAt)
    }
    if (params.data.status) {
      if (!isStatus(params.data.status)) throw new BadRequestException('status inválido')
      if (!this.canTransition(before.status, params.data.status)) {
        throw new BadRequestException(
          `Transição de status inválida: ${before.status} -> ${params.data.status}`,
        )
      }
      data.status = params.data.status
    }
    if (params.data.notes !== undefined) {
      data.notes = normalizeNotes(params.data.notes)
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar')
    }

    try {
      const updated = await this.prisma.appointment.update({
        where: { id: params.id },
        data,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
        },
      })

      const context = `Agendamento atualizado: ${updated.customer.name}`

      await this.timeline.log({
        orgId: params.orgId,
        personId: params.personId,
        action: statusToAction(updated.status),
        description: context,
        metadata: {
          appointmentId: updated.id,
          customerId: updated.customerId,
          actorUserId: params.updatedBy,
          actorPersonId: params.personId,
          updatedBy: params.updatedBy,
          patch: data,
        },
      })

      if (data.status && data.status !== before.status) {
        await this.enqueueAppointmentWorkflow({
          orgId: params.orgId,
          customerId: updated.customerId,
          appointmentId: updated.id,
          status: updated.status,
        })

        await this.automation.executeTrigger({
          orgId: params.orgId,
          trigger: 'APPOINTMENT_STATUS_CHANGED',
          payload: {
            appointmentId: updated.id,
            customerId: updated.customerId,
            customerPhone: updated.customer?.phone ?? null,
            startsAt: updated.startsAt,
            status: updated.status,
            entityId: updated.id,
            beforeStatus: before.status,
          },
        })
      }

      await this.audit.log({
        orgId: params.orgId,
        action: AUDIT_ACTIONS.APPOINTMENT_UPDATED,
        actorUserId: params.updatedBy,
        actorPersonId: params.personId,
        personId: params.personId,
        entityType: 'APPOINTMENT',
        entityId: updated.id,
        context,
        metadata: {
          appointmentId: updated.id,
          before: {
            startsAt: before.startsAt,
            endsAt: before.endsAt,
            status: before.status,
            notes: before.notes,
          },
          after: {
            startsAt: updated.startsAt,
            endsAt: updated.endsAt,
            status: updated.status,
            notes: updated.notes,
          },
          patch: data,
        },
      })

      return updated
    } catch (e: any) {
      if (isOverlapDbViolation(e)) {
        throw new ConflictException('Conflito de horário: já existe um agendamento nesse intervalo')
      }
      throw e
    }
  }
}
