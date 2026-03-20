import { Injectable, Inject } from '@nestjs/common'
import { RequestContextService } from '../common/context/request-context.service'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineQueryDto } from './dto/timeline-query.dto'
import { WebhookDispatcher } from '../webhooks/webhook.dispatcher'

type TimelineLogInput = {
  orgId: string
  action: string
  personId?: string | null
  description?: string | null
  metadata?: Record<string, any> | null
}

function pickActorUserId(metadata?: Record<string, any> | null): string | null {
  if (!metadata) return null

  const v1 = metadata.actorUserId
  if (typeof v1 === 'string' && v1.trim()) return v1.trim()

  const v2 = metadata.updatedBy ?? metadata.createdBy
  if (typeof v2 !== 'string') return null
  const s = v2.trim()
  return s ? s : null
}

function pickActorPersonId(metadata?: Record<string, any> | null): string | null {
  if (!metadata) return null
  const v = metadata.actorPersonId
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}

@Injectable()
export class TimelineService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly webhookDispatcher: WebhookDispatcher,
  ) {}

  async log(input: TimelineLogInput) {
    if (!input.orgId) {
      throw new Error('TimelineService.log(): orgId é obrigatório')
    }

    let personId = input.personId ?? null

    if (!personId) {
      const actorPersonId = pickActorPersonId(input.metadata ?? null)

      if (actorPersonId) {
        const exists = await this.prisma.person.findFirst({
          where: { id: actorPersonId, orgId: input.orgId },
          select: { id: true },
        })
        if (exists?.id) personId = exists.id
      }
    }

    if (!personId) {
      const actorUserId = pickActorUserId(input.metadata ?? null)

      if (actorUserId) {
        const person = await this.prisma.person.findFirst({
          where: { orgId: input.orgId, userId: actorUserId },
          select: { id: true },
        })

        if (person?.id) personId = person.id
      }
    }

    if (!personId && String(input.action || '').startsWith('APPOINTMENT_')) {
      console.warn(
        '[Timeline] APPOINTMENT_* sem personId. action=%s orgId=%s metadataKeys=%s',
        input.action,
        input.orgId,
        input.metadata ? Object.keys(input.metadata).join(',') : '',
      )
    }

    const requestId = this.requestContext.requestId

    const event = await this.prisma.timelineEvent.create({
      data: {
        orgId: input.orgId,
        action: input.action,
        personId,
        description: input.description ?? null,
        metadata: {
          ...(input.metadata ?? {}),
          ...(requestId ? { requestId } : {}),
        },
      },
    })

    try {
      await this.webhookDispatcher.dispatchTimelineEvent({
        orgId: input.orgId,
        action: input.action,
        timelineEventId: event.id,
        data: {
          personId,
          description: input.description ?? null,
          metadata: input.metadata ?? null,
        },
      })
    } catch (error) {
      console.warn(
        '[Timeline] Falha ao despachar webhook. action=%s orgId=%s error=%s',
        input.action,
        input.orgId,
        error instanceof Error ? error.message : String(error),
      )
    }

    return event
  }

  async listByOrg(orgId: string, query?: TimelineQueryDto) {
    const take =
      (query as any)?.limit && Number((query as any).limit) > 0
        ? Math.min(Number((query as any).limit), 200)
        : 50

    const action = (query as any)?.action
    const personId = (query as any)?.personId

    return this.prisma.timelineEvent.findMany({
      where: {
        orgId,
        ...(action ? { action: String(action) } : {}),
        ...(personId ? { personId: String(personId) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    })
  }

  async listByPersonInOrg(orgId: string, personId: string) {
    return this.prisma.timelineEvent.findMany({
      where: { orgId, personId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async listByCustomerInOrg(orgId: string, customerId: string, limit = 100) {
    return this.prisma.timelineEvent.findMany({
      where: {
        orgId,
        OR: [
          { metadata: { path: ['customerId'], equals: customerId } },
          { metadata: { path: ['entityId'], equals: customerId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 300),
    })
  }

  async listByServiceOrderInOrg(orgId: string, serviceOrderId: string, limit = 100) {
    return this.prisma.timelineEvent.findMany({
      where: {
        orgId,
        OR: [
          { metadata: { path: ['serviceOrderId'], equals: serviceOrderId } },
          { metadata: { path: ['entityId'], equals: serviceOrderId } },
          { metadata: { path: ['executionId'], equals: serviceOrderId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 300),
    })
  }
}
