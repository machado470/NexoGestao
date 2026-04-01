import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AuditAdminService {
  constructor(private readonly prisma: PrismaService) {}

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
    const limit = Math.min(Number(params.limit) || 50, 100)
    const skip = (page - 1) * limit

    const where: any = { orgId: params.orgId }

    if (params.entityType) where.entityType = params.entityType
    if (params.entityId) where.entityId = params.entityId
    if (params.action) where.action = params.action
    if (params.actorPersonId) where.actorPersonId = params.actorPersonId

    if (params.from || params.to) {
      where.createdAt = {}
      if (params.from) {
        const fromDate = new Date(params.from)
        if (!Number.isNaN(fromDate.getTime())) {
          where.createdAt.gte = fromDate
        }
      }
      if (params.to) {
        const toDate = new Date(params.to)
        if (!Number.isNaN(toDate.getTime())) {
          where.createdAt.lte = toDate
        }
      }
    }

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
        actorName: event.person?.name ?? 'Sistema',
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
      actorName: event.person?.name ?? 'Sistema',
    }
  }

  async getSummary(params: {
    orgId: string
    from?: string
    to?: string
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')

    const where: any = { orgId: params.orgId }

    if (params.from || params.to) {
      where.createdAt = {}
      if (params.from) {
        const fromDate = new Date(params.from)
        if (!Number.isNaN(fromDate.getTime())) {
          where.createdAt.gte = fromDate
        }
      }
      if (params.to) {
        const toDate = new Date(params.to)
        if (!Number.isNaN(toDate.getTime())) {
          where.createdAt.lte = toDate
        }
      }
    }

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

    return {
      total,
      byAction: byAction.map((item) => ({
        action: item.action,
        count: item._count.id,
      })),
      byActor: byActor.map((item) => ({
        actorPersonId: item.actorPersonId,
        count: item._count.id,
      })),
    }
  }
}
