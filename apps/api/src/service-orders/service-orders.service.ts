import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { ServiceOrderStatus } from '@prisma/client'

function normalizeText(v?: string): string | null {
  const s = (v ?? '').trim()
  return s ? s : null
}

function isStatus(v: any): v is ServiceOrderStatus {
  return (
    v === 'OPEN' ||
    v === 'ASSIGNED' ||
    v === 'IN_PROGRESS' ||
    v === 'DONE' ||
    v === 'CANCELED'
  )
}

function statusToAction(status: ServiceOrderStatus): string {
  switch (status) {
    case 'ASSIGNED':
      return 'SERVICE_ORDER_ASSIGNED'
    case 'IN_PROGRESS':
      return 'SERVICE_ORDER_STARTED'
    case 'DONE':
      return 'SERVICE_ORDER_DONE'
    case 'CANCELED':
      return 'SERVICE_ORDER_CANCELED'
    case 'OPEN':
    default:
      return 'SERVICE_ORDER_UPDATED'
  }
}

@Injectable()
export class ServiceOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
  ) {}

  async list(
    orgId: string,
    filters: {
      status?: ServiceOrderStatus
      customerId?: string
      assignedToPersonId?: string
    },
  ) {
    if (!orgId) throw new BadRequestException('orgId é obrigatório')

    const where: any = { orgId }

    if (filters.customerId) where.customerId = filters.customerId
    if (filters.assignedToPersonId) where.assignedToPersonId = filters.assignedToPersonId

    if (filters.status != null) {
      if (!isStatus(filters.status)) throw new BadRequestException('status inválido')
      where.status = filters.status
    }

    return this.prisma.serviceOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedToPerson: { select: { id: true, name: true } },
        appointment: { select: { id: true, startsAt: true, endsAt: true, status: true } },
      },
    })
  }

  async get(orgId: string, id: string) {
    if (!orgId) throw new BadRequestException('orgId é obrigatório')
    if (!id) throw new BadRequestException('id é obrigatório')

    const os = await this.prisma.serviceOrder.findFirst({
      where: { id, orgId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedToPerson: { select: { id: true, name: true } },
        appointment: { select: { id: true, startsAt: true, endsAt: true, status: true } },
      },
    })
    if (!os) throw new NotFoundException('Ordem de serviço não encontrada')
    return os
  }

  async create(params: {
    orgId: string
    createdBy: string | null
    personId: string | null
    customerId: string
    title: string
    description?: string
    priority?: number
    scheduledFor?: string
    appointmentId?: string
    assignedToPersonId?: string
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!params.customerId) throw new BadRequestException('customerId é obrigatório')

    const title = normalizeText(params.title)
    if (!title) throw new BadRequestException('title é obrigatório')

    const description = normalizeText(params.description)

    const priority =
      typeof params.priority === 'number' && Number.isFinite(params.priority)
        ? Math.min(5, Math.max(1, Math.floor(params.priority)))
        : 2

    let scheduledFor: Date | null = null
    if (typeof params.scheduledFor === 'string' && params.scheduledFor.trim()) {
      const d = new Date(params.scheduledFor.trim())
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('scheduledFor inválido (use ISO)')
      }
      scheduledFor = d
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: params.customerId, orgId: params.orgId },
      select: { id: true, name: true },
    })
    if (!customer) throw new BadRequestException('Cliente inválido para este org')

    // appointment opcional: valida org e customer
    if (params.appointmentId) {
      const appt = await this.prisma.appointment.findFirst({
        where: { id: params.appointmentId, orgId: params.orgId },
        select: { id: true, customerId: true },
      })
      if (!appt) throw new BadRequestException('appointmentId inválido para este org')
      if (appt.customerId !== params.customerId) {
        throw new BadRequestException('appointmentId não pertence ao mesmo customerId')
      }
    }

    // assignedTo opcional: valida org
    if (params.assignedToPersonId) {
      const p = await this.prisma.person.findFirst({
        where: { id: params.assignedToPersonId, orgId: params.orgId, active: true },
        select: { id: true },
      })
      if (!p) throw new BadRequestException('assignedToPersonId inválido para este org')
    }

    const created = await this.prisma.serviceOrder.create({
      data: {
        orgId: params.orgId,
        customerId: params.customerId,
        appointmentId: params.appointmentId ?? null,
        assignedToPersonId: params.assignedToPersonId ?? null,
        title,
        description,
        priority,
        scheduledFor,
        status: params.assignedToPersonId ? 'ASSIGNED' : 'OPEN',
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedToPerson: { select: { id: true, name: true } },
        appointment: { select: { id: true, startsAt: true, endsAt: true, status: true } },
      },
    })

    await this.timeline.log({
      orgId: params.orgId,
      personId: params.personId,
      action: 'SERVICE_ORDER_CREATED',
      description: `O.S. criada: ${created.title} (${created.customer.name})`,
      metadata: {
        serviceOrderId: created.id,
        customerId: created.customerId,
        appointmentId: created.appointmentId,
        assignedToPersonId: created.assignedToPersonId,
        status: created.status,
        priority: created.priority,
        scheduledFor: created.scheduledFor,

        // ✅ padrão novo (oficial)
        actorUserId: params.createdBy,
        actorPersonId: params.personId,

        // ✅ compat legado
        createdBy: params.createdBy,
      },
    })

    return created
  }

  async update(params: {
    orgId: string
    updatedBy: string | null
    personId: string | null
    id: string
    data: {
      title?: string
      description?: string
      priority?: number
      scheduledFor?: string
      status?: ServiceOrderStatus
      assignedToPersonId?: string | null
    }
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!params.id) throw new BadRequestException('id é obrigatório')

    const existing = await this.prisma.serviceOrder.findFirst({
      where: { id: params.id, orgId: params.orgId },
      select: {
        id: true,
        status: true,
        assignedToPersonId: true,
        customerId: true,
      },
    })
    if (!existing) throw new NotFoundException('Ordem de serviço não encontrada')

    const patch: any = {}

    if (typeof params.data.title === 'string') {
      const v = normalizeText(params.data.title)
      if (!v) throw new BadRequestException('title inválido')
      patch.title = v
    }

    if (typeof params.data.description === 'string') {
      patch.description = normalizeText(params.data.description)
    }

    if (typeof params.data.priority === 'number' && Number.isFinite(params.data.priority)) {
      patch.priority = Math.min(5, Math.max(1, Math.floor(params.data.priority)))
    }

    if (typeof params.data.scheduledFor === 'string') {
      const s = params.data.scheduledFor.trim()
      if (!s) {
        patch.scheduledFor = null
      } else {
        const d = new Date(s)
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('scheduledFor inválido (use ISO)')
        }
        patch.scheduledFor = d
      }
    }

    if (typeof params.data.status === 'string') {
      if (!isStatus(params.data.status)) throw new BadRequestException('status inválido')
      patch.status = params.data.status
    }

    if (params.data.assignedToPersonId !== undefined) {
      const v = params.data.assignedToPersonId
      if (v === null) {
        patch.assignedToPersonId = null
      } else if (typeof v === 'string' && v.trim()) {
        const p = await this.prisma.person.findFirst({
          where: { id: v.trim(), orgId: params.orgId, active: true },
          select: { id: true },
        })
        if (!p) throw new BadRequestException('assignedToPersonId inválido para este org')
        patch.assignedToPersonId = v.trim()
      } else {
        throw new BadRequestException('assignedToPersonId inválido')
      }
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar')
    }

    // Regras de estado mínimas:
    // - se atribuiu alguém e status era OPEN, vira ASSIGNED
    if (
      patch.assignedToPersonId &&
      !patch.status &&
      existing.status === 'OPEN'
    ) {
      patch.status = 'ASSIGNED'
    }

    // timestamps automáticos por status
    if (patch.status && patch.status !== existing.status) {
      if (patch.status === 'IN_PROGRESS') patch.startedAt = new Date()
      if (patch.status === 'DONE') patch.finishedAt = new Date()
      if (patch.status === 'CANCELED') patch.finishedAt = new Date()
    }

    const result = await this.prisma.serviceOrder.updateMany({
      where: { id: params.id, orgId: params.orgId },
      data: patch,
    })
    if (result.count === 0) throw new NotFoundException('Ordem de serviço não encontrada')

    const updated = await this.prisma.serviceOrder.findFirst({
      where: { id: params.id, orgId: params.orgId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedToPerson: { select: { id: true, name: true } },
        appointment: { select: { id: true, startsAt: true, endsAt: true, status: true } },
      },
    })
    if (!updated) throw new NotFoundException('Ordem de serviço não encontrada')

    const statusChanged = patch.status && patch.status !== existing.status

    await this.timeline.log({
      orgId: params.orgId,
      personId: params.personId,
      action: statusChanged ? statusToAction(updated.status) : 'SERVICE_ORDER_UPDATED',
      description: `O.S. atualizada: ${updated.title} (${updated.customer.name})`,
      metadata: {
        serviceOrderId: updated.id,
        customerId: updated.customerId,
        appointmentId: updated.appointmentId,
        assignedToPersonId: updated.assignedToPersonId,
        status: updated.status,

        // ✅ padrão novo (oficial)
        actorUserId: params.updatedBy,
        actorPersonId: params.personId,

        // ✅ compat legado
        updatedBy: params.updatedBy,

        patch,
      },
    })

    return updated
  }
}
