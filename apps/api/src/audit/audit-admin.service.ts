import { Injectable, BadRequestException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

type AuditEventFilters = {
  orgId: string
  entityType?: string
  entityId?: string
  action?: string
  actorPersonId?: string
  from?: string
  to?: string
}

const MAX_EXPORT_ROWS = 5000

function csvCell(value: string | null) {
  const text = value ?? ''
  const safe = /^[\s\p{Cf}]*[=+@-]|^[\t\r\n]/u.test(text) ? "'" + text : text
  return '"' + safe.replace(/"/g, '""') + '"'
}

@Injectable()
export class AuditAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateRange(from?: string, to?: string) {
    const gte = from ? new Date(from) : undefined
    const lte = to ? new Date(to) : undefined
    if ((gte && Number.isNaN(gte.getTime())) || (lte && Number.isNaN(lte.getTime()))) {
      throw new BadRequestException('Informe datas válidas para o período')
    }
    if (gte && lte && gte > lte) {
      throw new BadRequestException('A data inicial deve ser anterior ou igual à data final')
    }
    return gte || lte ? { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } : undefined
  }

  private eventFilter(params: AuditEventFilters): Prisma.AuditEventWhereInput {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    const where: Prisma.AuditEventWhereInput = { orgId: params.orgId }

    if (params.entityType) where.entityType = params.entityType
    if (params.entityId) where.entityId = params.entityId
    if (params.action) where.action = params.action
    if (params.actorPersonId) where.actorPersonId = params.actorPersonId

    const dateRange = this.getDateRange(params.from, params.to)
    if (dateRange) where.createdAt = dateRange

    return where
  }

  async listEvents(params: AuditEventFilters & { page?: number; limit?: number }) {
    const where = this.eventFilter(params)
    const page = Number(params.page) || 1
    const requestedLimit = Number(params.limit) || 50
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(requestedLimit) || requestedLimit < 1) {
      throw new BadRequestException('Página e limite devem ser números inteiros positivos')
    }
    const limit = Math.min(requestedLimit, 100)
    const skip = (page - 1) * limit
    if (!Number.isSafeInteger(skip)) {
      throw new BadRequestException('Página fora do intervalo permitido')
    }

    const [events, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        include: {
          person: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.auditEvent.count({ where }),
    ])

    return {
      data: events.map((event) => ({
        ...event,
        actorName: event.person?.name ?? (event.actorPersonId || event.actorUserId ? 'Ator não identificado' : 'Sistema'),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }
  }

  async exportEvents(params: AuditEventFilters) {
    const events = await this.prisma.auditEvent.findMany({
      where: this.eventFilter(params),
      select: {
        id: true, createdAt: true, action: true, entityType: true, entityId: true,
        actorPersonId: true, actorUserId: true, person: { select: { name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_EXPORT_ROWS + 1,
    })
    if (events.length > MAX_EXPORT_ROWS) {
      throw new BadRequestException('O recorte tem mais de 5.000 registros. Reduza o período ou aplique outros filtros.')
    }
    const rows = events.map(event => [
      event.id, event.createdAt.toISOString(), event.action, event.entityType, event.entityId,
      event.person?.name ?? (event.actorPersonId || event.actorUserId ? 'Ator não identificado' : 'Sistema'),
    ].map(csvCell).join(','))
    return {
      csv: ['ID,Data e hora (UTC),Ação,Tipo de entidade,ID da entidade,Ator', ...rows].join('\r\n'),
    }
  }

  async getEventDetail(orgId: string, eventId: string) {
    if (!orgId) throw new BadRequestException('orgId é obrigatório')
    if (!eventId) throw new BadRequestException('eventId é obrigatório')

    const event = await this.prisma.auditEvent.findFirst({
      where: { id: eventId, orgId },
      include: {
        person: { select: { id: true, name: true, email: true } },
      },
    })

    if (!event) {
      return null
    }

    return {
      ...event,
      actorName: event.person?.name ?? (event.actorPersonId || event.actorUserId ? 'Ator não identificado' : 'Sistema'),
    }
  }

  async getSummary(params: {
    orgId: string
    from?: string
    to?: string
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')

    const where: any = { orgId: params.orgId }

    const dateRange = this.getDateRange(params.from, params.to)
    if (dateRange) where.createdAt = dateRange

    const [byAction, byActor, total] = await Promise.all([
      this.prisma.auditEvent.groupBy({
        by: ['action'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.auditEvent.groupBy({
        by: ['actorPersonId'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.auditEvent.count({ where }),
    ])

    const actorIds = byActor.map(item => item.actorPersonId).filter((id): id is string => typeof id === 'string')
    const people = actorIds.length ? await this.prisma.person.findMany({
      where: { orgId: params.orgId, id: { in: actorIds } },
      select: { id: true, name: true },
    }) : []
    const actorNames = new Map(people.map(person => [person.id, person.name]))

    return {
      total,
      byAction: byAction.map((item) => ({
        action: item.action,
        count: item._count.id,
      })),
      byActor: byActor.map((item) => ({
        actorPersonId: item.actorPersonId,
        actorName: item.actorPersonId ? actorNames.get(item.actorPersonId) ?? null : null,
        count: item._count.id,
      })),
    }
  }
}
