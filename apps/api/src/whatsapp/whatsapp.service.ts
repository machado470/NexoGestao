import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import {
  WhatsAppEntityType,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import { QUEUE_NAMES } from '../queue/queue.constants'
import { TimelineService } from '../timeline/timeline.service'
import { RequestContextService } from '../common/context/request-context.service'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'
import {
  CommercialPolicyService,
  isCommercialBlocked,
} from '../common/commercial/commercial-policy.service'

type QueueMessageInput = {
  orgId: string
  customerId: string
  toPhone: string
  entityType: WhatsAppEntityType
  entityId: string
  messageType: WhatsAppMessageType
  messageKey: string
  renderedText: string
}

export function buildDeterministicMessageKey(input: {
  entityType: WhatsAppEntityType
  entityId: string
  messageType: WhatsAppMessageType
}): string {
  return `${input.entityType}:${input.entityId}:${input.messageType}`
}

function isPrismaP1017(err: any): boolean {
  return (
    err?.code === 'P1017' ||
    String(err?.message ?? '').includes('closed the connection')
  )
}

export type ConversationStatus = 'awaiting' | 'ok' | 'failed'
export type ConversationContextType = 'charge' | 'appointment' | 'os'

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly timeline: TimelineService,
    private readonly requestContext: RequestContextService,
    private readonly tenantOps: TenantOperationsService,
    private readonly commercial: CommercialPolicyService,
  ) {}

  private async assertEntityBelongsToOrg(input: {
    orgId: string
    entityType: WhatsAppEntityType
    entityId: string
    customerId: string
  }) {
    if (input.entityType === WhatsAppEntityType.SERVICE_ORDER) {
      const exists = await this.prisma.serviceOrder.findFirst({
        where: {
          id: input.entityId,
          orgId: input.orgId,
          customerId: input.customerId,
        },
        select: { id: true },
      })
      if (!exists) throw new BadRequestException('entityId de ServiceOrder inválido para este tenant')
      return
    }

    if (input.entityType === WhatsAppEntityType.APPOINTMENT) {
      const exists = await this.prisma.appointment.findFirst({
        where: {
          id: input.entityId,
          orgId: input.orgId,
          customerId: input.customerId,
        },
        select: { id: true },
      })
      if (!exists) throw new BadRequestException('entityId de Appointment inválido para este tenant')
      return
    }

    if (input.entityType === WhatsAppEntityType.CHARGE) {
      const exists = await this.prisma.charge.findFirst({
        where: {
          id: input.entityId,
          orgId: input.orgId,
          customerId: input.customerId,
        },
        select: { id: true },
      })
      if (!exists) throw new BadRequestException('entityId de Charge inválido para este tenant')
    }
  }

  private logStructured(params: {
    level: 'log' | 'warn' | 'error'
    action: string
    entityId?: string | null
    message: string
    extra?: Record<string, unknown>
  }) {
    const line = JSON.stringify({
      requestId: this.requestContext.requestId,
      action: params.action,
      entityId: params.entityId ?? null,
      message: params.message,
      ...params.extra,
    })

    if (params.level === 'error') {
      this.logger.error(line)
      return
    }
    if (params.level === 'warn') {
      this.logger.warn(line)
      return
    }
    this.logger.log(line)
  }

  async enqueueMessage(input: QueueMessageInput) {
    const result = await this.queueMessage(input)
    const message = result.message
    if (!message) return result

    await this.queueService.addJob(QUEUE_NAMES.WHATSAPP, 'dispatch-message', {
      messageId: message.id,
    }, {
      jobId: `whatsapp:dispatch:${message.id}`,
    })

    return result
  }

  async findById(id: string) {
    return this.prisma.whatsAppMessage.findUnique({ where: { id } })
  }

  async listConversations(orgId: string) {
    const [customers, latestMessages, failedMessages, overdueCharges, nextAppointments, activeServiceOrders] =
      await Promise.all([
        this.prisma.customer.findMany({
          where: { orgId, active: true },
          select: {
            id: true,
            name: true,
            updatedAt: true,
          },
        }),
        this.prisma.whatsAppMessage.findMany({
          where: { orgId },
          orderBy: [{ customerId: 'asc' }, { createdAt: 'desc' }],
          distinct: ['customerId'],
          select: {
            customerId: true,
            createdAt: true,
            status: true,
            renderedText: true,
          },
        }),
        this.prisma.whatsAppMessage.groupBy({
          by: ['customerId'],
          where: {
            orgId,
            status: WhatsAppMessageStatus.FAILED,
          },
          _count: { _all: true },
        }),
        this.prisma.charge.groupBy({
          by: ['customerId'],
          where: {
            orgId,
            status: 'OVERDUE',
          },
          _count: { _all: true },
          _sum: { amountCents: true },
        }),
        this.prisma.appointment.findMany({
          where: {
            orgId,
            status: {
              in: ['SCHEDULED', 'CONFIRMED'],
            },
          },
          orderBy: { startsAt: 'asc' },
          distinct: ['customerId'],
          select: {
            customerId: true,
            startsAt: true,
          },
        }),
        this.prisma.serviceOrder.findMany({
          where: {
            orgId,
            status: {
              in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'],
            },
          },
          orderBy: { updatedAt: 'desc' },
          distinct: ['customerId'],
          select: {
            customerId: true,
            status: true,
            updatedAt: true,
          },
        }),
      ])

    const latestByCustomer = new Map(latestMessages.map((item) => [item.customerId, item]))
    const failedByCustomer = new Map(
      failedMessages.map((item) => [item.customerId, Number(item._count._all ?? 0)]),
    )
    const overdueByCustomer = new Map(
      overdueCharges.map((item) => [
        item.customerId,
        {
          count: Number(item._count._all ?? 0),
          totalCents: Number(item._sum.amountCents ?? 0),
        },
      ]),
    )
    const appointmentByCustomer = new Map(
      nextAppointments.map((item) => [item.customerId, item.startsAt]),
    )
    const serviceOrderByCustomer = new Map(activeServiceOrders.map((item) => [item.customerId, item]))

    const now = Date.now()

    return customers
      .map((customer) => {
        const lastMessage = latestByCustomer.get(customer.id)
        const failedCount = failedByCustomer.get(customer.id) ?? 0
        const overdue = overdueByCustomer.get(customer.id)
        const appointmentDate = appointmentByCustomer.get(customer.id)
        const activeOrder = serviceOrderByCustomer.get(customer.id)

        const lastMessageAt = lastMessage?.createdAt ?? customer.updatedAt
        const lastContactDays = Math.floor((now - new Date(lastMessageAt).getTime()) / 86_400_000)
        const isAwaiting = lastContactDays >= 2

        const contextType: ConversationContextType = overdue
          ? 'charge'
          : appointmentDate
            ? 'appointment'
            : 'os'

        const status: ConversationStatus = failedCount > 0 ? 'failed' : isAwaiting ? 'awaiting' : 'ok'

        const priorityScore =
          failedCount * 8 +
          Number(Boolean(overdue)) * 6 +
          Number(Boolean(appointmentDate)) * 3 +
          Number(Boolean(activeOrder)) * 2 +
          Number(isAwaiting) * 3

        return {
          customerId: customer.id,
          name: customer.name,
          lastMessage: lastMessage?.renderedText ?? 'Sem mensagem recente',
          lastMessageAt,
          status,
          contextType,
          priorityScore,
          context: {
            nextAppointmentAt: appointmentDate ?? null,
            activeServiceOrderStatus: activeOrder?.status ?? null,
            overdueAmountCents: overdue?.totalCents ?? 0,
            overdueCount: overdue?.count ?? 0,
          },
        }
      })
      .sort((a, b) => {
        if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      })
  }

  async getMessagesFeed(params: {
    orgId: string
    customerId: string
    limit?: number
    cursor?: string
  }) {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)
    const rows = await this.prisma.whatsAppMessage.findMany({
      where: {
        orgId: params.orgId,
        customerId: params.customerId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      take: limit + 1,
    })

    const hasMore = rows.length > limit
    const sliced = hasMore ? rows.slice(0, limit) : rows

    return {
      items: sliced,
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    }
  }

  private async reconnectIfNeeded(err: any) {
    if (!isPrismaP1017(err)) return false

    this.logger.warn('[P1017] DB connection closed. Reconnecting Prisma...')

    try {
      await this.prisma.$disconnect()
    } catch {}

    try {
      await this.prisma.$connect()
      this.logger.warn('[P1017] Prisma reconnected.')
      return true
    } catch (e: any) {
      this.logger.error(
        `[P1017] Prisma reconnect failed: ${e?.message ?? e}`,
      )
      return false
    }
  }

  async queueMessage(input: QueueMessageInput) {
    const {
      orgId,
      customerId,
      toPhone,
      entityType,
      entityId,
      messageType,
      messageKey,
      renderedText,
    } = input

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, orgId },
      select: { id: true },
    })

    if (!customer) {
      this.tenantOps.increment(orgId, 'whatsapp_blocked')
      throw new BadRequestException('customerId não pertence ao tenant informado')
    }

    await this.assertEntityBelongsToOrg({
      orgId,
      entityType,
      entityId,
      customerId,
    })

    const commercialLimit = await this.commercial.enforceMeter(orgId, 'message_sends')
    if (isCommercialBlocked(commercialLimit)) {
      this.tenantOps.increment(orgId, 'whatsapp_blocked')
      throw new BadRequestException(
        `Envio bloqueado por política comercial: ${commercialLimit.reasonCode}`,
      )
    }

    const limitCheck = this.tenantOps.enforceLimit({
      orgId,
      scope: 'whatsapp:queue',
      limit: 120,
      windowMs: 60_000,
      blockedReason: 'tenant_whatsapp_rate_limit_reached',
    })

    if (!limitCheck.allowed) {
      this.tenantOps.increment(orgId, 'whatsapp_blocked')
      this.tenantOps.recordCriticalEvent(orgId, 'whatsapp_throttled', {
        reason: limitCheck.reason,
        used: limitCheck.used,
        limit: limitCheck.limit,
      })
      throw new BadRequestException(
        `Envio temporariamente bloqueado: ${limitCheck.reason}`,
      )
    }

    try {
      const created = await this.prisma.whatsAppMessage.create({
        data: {
          orgId,
          customerId,
          toPhone,
          entityType,
          entityId,
          messageType,
          messageKey,
          renderedText,
          status: WhatsAppMessageStatus.QUEUED,
        },
      })

      this.logStructured({
        level: 'log',
        action: 'WHATSAPP_MESSAGE_QUEUED',
        entityId: created.id,
        message: 'Mensagem WhatsApp enfileirada',
        extra: {
          messageKey,
          messageType,
          toPhone,
        },
      })
      this.tenantOps.increment(orgId, 'whatsapp_queued')

      return { created: true, message: created }
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const existing = await this.prisma.whatsAppMessage.findUnique({
          where: { messageKey },
        })
        return { created: false, message: existing }
      }

      throw err
    }
  }

  async claimQueued(params: { limit?: number; workerId: string }) {
    const limit = params.limit ?? 50
    const workerId = params.workerId

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const claimedIds = await this.prisma.$transaction(async (tx) => {
          const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
            `
            WITH picked AS (
              SELECT id
              FROM "WhatsAppMessage"
              WHERE status = 'QUEUED'
              ORDER BY "createdAt" ASC
              FOR UPDATE SKIP LOCKED
              LIMIT $1
            )
            UPDATE "WhatsAppMessage" m
            SET status = 'SENDING'
            FROM picked
            WHERE m.id = picked.id
            RETURNING m.id;
            `,
            limit,
          )

          return rows.map((r) => r.id)
        })

        if (claimedIds.length === 0) return []

        const claimed = await this.prisma.whatsAppMessage.findMany({
          where: { id: { in: claimedIds } },
          orderBy: { createdAt: 'asc' },
        })

        this.logger.log(
          `claimed ${claimed.length} whatsapp message(s) worker=${workerId}`,
        )

        return claimed
      } catch (err: any) {
        const reconnected = await this.reconnectIfNeeded(err)

        if (reconnected && attempt === 1) {
          this.logger.warn(
            `[claimQueued] retry after reconnect worker=${workerId}`,
          )
          continue
        }

        throw err
      }
    }

    return []
  }

  async findQueued(limit = 50) {
    return this.prisma.whatsAppMessage.findMany({
      where: { status: WhatsAppMessageStatus.QUEUED },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
  }

  async markSent(params: {
    id: string
    provider: string
    providerMessageId: string
  }) {
    const { id, provider, providerMessageId } = params

    this.logger.log(
      `whatsapp sent id=${id} provider=${provider} providerMessageId=${providerMessageId}`,
    )

    const updated = await this.prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status: WhatsAppMessageStatus.SENT,
        provider,
        providerMessageId,
        errorCode: null,
        errorMessage: null,
      },
    })

    await this.timeline
      .log({
        orgId: updated.orgId,
        action: 'WHATSAPP_MESSAGE_SENT',
        description: `Mensagem WhatsApp enviada (${updated.messageType})`,
        customerId: updated.customerId,
        serviceOrderId:
          updated.entityType === WhatsAppEntityType.SERVICE_ORDER
            ? updated.entityId
            : null,
        appointmentId:
          updated.entityType === WhatsAppEntityType.APPOINTMENT
            ? updated.entityId
            : null,
        chargeId:
          updated.entityType === WhatsAppEntityType.CHARGE ? updated.entityId : null,
        metadata: {
          messageId: updated.id,
          entityId: updated.entityId,
          entityType: updated.entityType,
          messageType: updated.messageType,
          provider,
          providerMessageId,
        },
      })
      .catch((error) => {
        this.logStructured({
          level: 'error',
          action: 'WHATSAPP_TIMELINE_LOG_FAILED',
          entityId: updated.id,
          message: 'Falha ao registrar envio de WhatsApp na timeline',
          extra: { error: error instanceof Error ? error.message : String(error) },
        })
      })

    return updated
  }


  async markFailedTerminal(params: {
    id: string
    provider: string
    errorCode: string
    errorMessage: string
  }) {
    const { id, provider, errorCode, errorMessage } = params

    this.logStructured({
      level: 'error',
      action: 'WHATSAPP_SEND_FAILED_TERMINAL',
      entityId: id,
      message:
        'Falha fatal de envio WhatsApp. Mensagem marcada como FAILED (sem requeue automático)',
      extra: { provider, errorCode, errorMessage },
    })

    return this.prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status: WhatsAppMessageStatus.FAILED,
        provider,
        errorCode,
        errorMessage,
      },
    })
  }
  async markFailedAndRequeue(params: {
    id: string
    provider: string
    errorCode: string
    errorMessage: string
  }) {
    const { id, provider, errorCode, errorMessage } = params

    this.logStructured({
      level: 'warn',
      action: 'WHATSAPP_SEND_FAILED_REQUEUED',
      entityId: id,
      message: 'Falha de envio WhatsApp. Mensagem voltou para fila (modo degradado)',
      extra: { provider, errorCode, errorMessage },
    })

    return this.prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status: WhatsAppMessageStatus.QUEUED,
        provider,
        errorCode,
        errorMessage,
      },
    })
  }
}
