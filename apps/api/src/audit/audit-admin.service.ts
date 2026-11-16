import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

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

  async listEvents(params: {
    orgId: string
    entityType?: string
    entityId?: string
    action?: string
    actorPersonId?: string
    from?: string
    to?: string
    page?: number
    limit?: number
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')

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

    const where: any = { orgId: params.orgId }

    if (params.entityType) where.entityType = params.entityType
    if (params.entityId) where.entityId = params.entityId
    if (params.action) where.action = params.action
    if (params.actorPersonId) where.actorPersonId = params.actorPersonId

    const dateRange = this.getDateRange(params.from, params.to)
    if (dateRange) where.createdAt = dateRange

    const [events, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        include: {
          person: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
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
