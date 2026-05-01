import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import {
  Prisma,
  WhatsAppContextType,
  WhatsAppConversationPriority,
  WhatsAppConversationStatus,
  WhatsAppDirection,
  WhatsAppEntityType,
  WhatsAppMessageStatus,
  WhatsAppMessageType,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import { WhatsAppObservabilityService } from '../common/metrics/whatsapp-observability.service'
import { QUEUE_NAMES } from '../queue/queue.constants'
import { TimelineService } from '../timeline/timeline.service'
import { RequestContextService } from '../common/context/request-context.service'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'
import { CommercialPolicyService, isCommercialBlocked } from '../common/commercial/commercial-policy.service'
import { createWhatsAppProvider } from './providers/provider.factory'
import { WhatsAppTemplateService } from './whatsapp-template.service'
import { WhatsAppContextService } from './whatsapp-context.service'
import { buildCommunicationFailureSignal } from '../governance/communication-failure.signal'
import { normalizePhone } from './phone.util'

export function buildDeterministicMessageKey(input: { entityType: WhatsAppEntityType; entityId: string; messageType: WhatsAppMessageType }) {
  return `${input.entityType}:${input.entityId}:${input.messageType}`
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name)
  private logTransition(action: string, meta: Record<string, unknown>) {
    this.logger.log(JSON.stringify({ requestId: this.requestContext.requestId, userId: this.requestContext.userId, orgId: this.requestContext.orgId, action, ...meta }))
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly waMetrics: WhatsAppObservabilityService,
    private readonly timeline: TimelineService,
    private readonly requestContext: RequestContextService,
    private readonly tenantOps: TenantOperationsService,
    private readonly commercial: CommercialPolicyService,
    private readonly templateService?: WhatsAppTemplateService,
    private readonly contextService?: WhatsAppContextService,
  ) {}

  async listConversations(orgId: string, filters: any = {}) {
    const statusFilter =
      filters.status
      ?? (filters.onlyFailed ? WhatsAppConversationStatus.FAILED : undefined)
      ?? (filters.onlyPending ? WhatsAppConversationStatus.WAITING_CUSTOMER : undefined)

    const where: Prisma.WhatsAppConversationWhereInput = {
      orgId,
      customerId: filters.customerId ?? undefined,
      status: statusFilter,
      priority: filters.priority ?? undefined,
      contextType: filters.contextType ?? undefined,
      unreadCount: filters.onlyUnread ? { gt: 0 } : undefined,
    }

    if (filters.search) {
      where.OR = [
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
        { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
      ]
    }

    const take = Math.min(Math.max(Number(filters.limit ?? 50), 1), 200)
    const items = await this.prisma.whatsAppConversation.findMany({
      where,
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: [
        { priority: 'desc' },
        { unreadCount: 'desc' },
        { status: 'asc' },
        { lastMessageAt: 'desc' },
      ],
      cursor: filters.cursor ? { id: String(filters.cursor) } : undefined,
      skip: filters.cursor ? 1 : 0,
      take: take + 1,
    })
    const hasMore = items.length > take
    const sliced = hasMore ? items.slice(0, take) : items
    const customerIds = [...new Set(sliced.map((item) => item.customerId).filter(Boolean) as string[])]
    const conversationIds = sliced.map((item) => item.id)
    const [failedGroups, pendingChargesByCustomer, overdueChargesByCustomer, appointmentsByCustomer, serviceOrdersByCustomer] = await Promise.all([
      this.prisma.whatsAppMessage.groupBy({ by: ['conversationId'], where: { orgId, conversationId: { in: conversationIds }, status: 'FAILED' }, _count: { _all: true } }),
      this.prisma.charge.groupBy({ by: ['customerId'], where: { orgId, customerId: { in: customerIds }, status: 'PENDING' }, _count: { _all: true } }),
      this.prisma.charge.groupBy({ by: ['customerId'], where: { orgId, customerId: { in: customerIds }, status: 'OVERDUE' }, _count: { _all: true } }),
      this.prisma.appointment.groupBy({ by: ['customerId'], where: { orgId, customerId: { in: customerIds }, status: { in: ['SCHEDULED', 'CONFIRMED'] } }, _count: { _all: true } }),
      this.prisma.serviceOrder.groupBy({ by: ['customerId'], where: { orgId, customerId: { in: customerIds }, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } }, _count: { _all: true } }),
    ])
    const failedMap = new Map(failedGroups.map((g) => [g.conversationId, g._count._all]))
    const pendingMap = new Map(pendingChargesByCustomer.map((g) => [g.customerId, g._count._all]))
    const overdueMap = new Map(overdueChargesByCustomer.map((g) => [g.customerId, g._count._all]))
    const appointmentMap = new Map(appointmentsByCustomer.map((g) => [g.customerId, g._count._all]))
    const serviceOrderMap = new Map(serviceOrdersByCustomer.map((g) => [g.customerId, g._count._all]))
    return {
      items: sliced.map((item) => ({
      ...item,
      priority: this.calculateInboxPriority(item, {
        hasPendingCharge: (pendingMap.get(item.customerId ?? '') ?? 0) > 0,
        hasOverdueCharge: (overdueMap.get(item.customerId ?? '') ?? 0) > 0,
        failedMessageCount: failedMap.get(item.id) ?? 0,
      }),
      lastMessage: item.lastMessageAt,
      noResponseSince: item.lastInboundAt && (!item.lastOutboundAt || item.lastInboundAt > item.lastOutboundAt) ? item.lastInboundAt : null,
      noResponseMinutes: item.lastInboundAt && (!item.lastOutboundAt || item.lastInboundAt > item.lastOutboundAt) ? Math.floor((Date.now() - item.lastInboundAt.getTime()) / 60000) : null,
      noResponseHours: item.lastInboundAt && (!item.lastOutboundAt || item.lastInboundAt > item.lastOutboundAt) ? Number(((Date.now() - item.lastInboundAt.getTime()) / 3600000).toFixed(1)) : null,
      failedMessageCount: failedMap.get(item.id) ?? 0,
      nextAction: this.resolveNextAction({
        failedMessageCount: failedMap.get(item.id) ?? 0,
        hasPendingCharge: (pendingMap.get(item.customerId ?? '') ?? 0) > 0 || (overdueMap.get(item.customerId ?? '') ?? 0) > 0,
        hasUpcomingAppointment: (appointmentMap.get(item.customerId ?? '') ?? 0) > 0,
        hasActiveServiceOrder: (serviceOrderMap.get(item.customerId ?? '') ?? 0) > 0,
      }),
      flags: {
        hasPendingCharge: (pendingMap.get(item.customerId ?? '') ?? 0) > 0 || (overdueMap.get(item.customerId ?? '') ?? 0) > 0,
        hasNoResponse: item.status === WhatsAppConversationStatus.WAITING_CUSTOMER,
        hasFailure: item.status === WhatsAppConversationStatus.FAILED || (failedMap.get(item.id) ?? 0) > 0,
      },
      })),
      nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
    }
  }

  async getConversation(orgId: string, conversationId: string) {
    return this.prisma.whatsAppConversation.findFirst({
      where: { id: conversationId, orgId },
      include: { customer: true },
    })
  }

  async getMessages(orgId: string, conversationId: string) {
    return this.prisma.whatsAppMessage.findMany({
      where: { orgId, conversationId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getContext(orgId: string, conversationId: string) {
    const conv = await this.getConversation(orgId, conversationId)
    if (!conv?.customerId) return null
    if (!this.contextService) return null
    return this.contextService.getOperationalContext(orgId, conv.customerId)
  }

  async sendManualMessage(orgId: string, userId: string | null, input: any) {
    const content = String(input.content ?? '').trim()
    if (!content) throw new BadRequestException('content é obrigatório')

    const queued = await this.enqueueMessage(orgId, {
      customerId: input.customerId,
      conversationId: input.conversationId,
      toPhone: input.toPhone,
      entityType: input.entityType ?? 'CUSTOMER',
      entityId: input.entityId ?? input.customerId,
      messageType: input.messageType ?? 'MANUAL',
      content,
    })

    await this.timeline.log({
      orgId,
      action: 'WHATSAPP_MESSAGE_SENT',
      customerId: queued.message?.customerId ?? input.customerId ?? null,
      metadata: {
        actorUserId: userId,
        messageId: queued.message?.id ?? null,
        conversationId: queued.message?.conversationId ?? null,
        entityType: input.entityType ?? 'CUSTOMER',
        entityId: input.entityId ?? input.customerId,
        provider: null,
        status: queued.message?.status ?? 'QUEUED',
        messageType: input.messageType ?? 'MANUAL',
      },
    }).catch(() => null)

    return queued
  }

  async sendTemplateMessage(orgId: string, userId: string | null, input: any) {
    if (!this.templateService) throw new BadRequestException('Template service indisponível')
    const rendered = await this.templateService.renderTemplate(orgId, input.templateKey, input.context ?? {})
    return this.sendManualMessage(orgId, userId, {
      ...input,
      messageType: input.messageType ?? rendered.template.messageType,
      content: rendered.content,
    })
  }

  async enqueueMessage(orgIdOrInput: string | any, maybeInput?: any) {
    const orgId = typeof orgIdOrInput === "string" ? orgIdOrInput : orgIdOrInput.orgId
    const input = typeof orgIdOrInput === "string" ? maybeInput : orgIdOrInput
    if (!orgId) throw new BadRequestException('orgId é obrigatório')

    const customer = input.customerId
      ? await this.prisma.customer.findFirst({ where: { id: input.customerId, orgId }, select: { id: true, phone: true } })
      : null

    if (input.customerId && !customer) {
      throw new BadRequestException('Cliente não encontrado para envio de WhatsApp')
    }

    const toPhone = normalizePhone(String(input.toPhone ?? customer?.phone ?? '').trim())
    if (!toPhone) throw new BadRequestException('Telefone de destino não informado')

    const commercialLimit = await this.commercial.enforceMeter(orgId, 'message_sends')
    if (isCommercialBlocked(commercialLimit)) {
      this.tenantOps.increment(orgId, 'whatsapp_blocked')
      throw new BadRequestException(`Envio bloqueado por política comercial: ${commercialLimit.reasonCode}`)
    }

    const conversation = input.conversationId
      ? await this.prisma.whatsAppConversation.findFirst({
          where: { id: String(input.conversationId), orgId },
        })
      : await this.resolveOrCreateConversation(
          orgId,
          input.customerId ?? null,
          toPhone,
          { contextType: input.entityType ?? 'GENERAL', contextId: input.entityId ?? null },
        )

    if (!conversation) {
      throw new BadRequestException('Conversa não encontrada para envio de WhatsApp')
    }

    const message = await this.prisma.whatsAppMessage.create({
      data: {
        orgId,
        conversationId: conversation.id,
        customerId: input.customerId ?? conversation.customerId ?? null,
        direction: 'OUTBOUND',
        entityType: (input.entityType ?? 'GENERAL') as WhatsAppEntityType,
        entityId: String(input.entityId ?? input.customerId ?? conversation.customerId ?? conversation.id),
        messageType: (input.messageType ?? 'MANUAL') as WhatsAppMessageType,
        messageKey: input.messageKey ?? null,
        toPhone,
        fromPhone: input.fromPhone ?? null,
        renderedText: String(input.content ?? input.renderedText ?? '').trim(),
        content: String(input.content ?? input.renderedText ?? '').trim(),
        status: 'QUEUED',
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    })

    await this.touchConversation(conversation.id, {
      lastMessageAt: message.createdAt,
      lastOutboundAt: message.createdAt,
      status: WhatsAppConversationStatus.WAITING_CUSTOMER,
    })
    this.logTransition('whatsapp.outbound', { conversationId: conversation.id, messageId: message.id, status: 'WAITING_CUSTOMER' })

    await this.queueService.addJob(QUEUE_NAMES.WHATSAPP, 'dispatch-message', { messageId: message.id }, { jobId: `whatsapp:dispatch:${message.id}` })

    this.tenantOps.increment(orgId, 'whatsapp_queued')
    this.waMetrics.incOutbound()
    return { created: true, message }
  }

  async updateMessageStatus(orgId: string, input: { id: string; status: WhatsAppMessageStatus; errorMessage?: string | null }) {
    const data: Prisma.WhatsAppMessageUpdateInput = { status: input.status }
    if (input.status === 'SENT') data.sentAt = new Date()
    if (input.status === 'DELIVERED') data.deliveredAt = new Date()
    if (input.status === 'READ') data.readAt = new Date()
    if (input.status === 'FAILED') {
      data.failedAt = new Date()
      data.errorMessage = input.errorMessage ?? 'Falha de envio'
    }

    const updated = await this.prisma.whatsAppMessage.update({ where: { id: input.id }, data })
    await this.timeline.log({
      orgId,
      action: input.status === 'FAILED' ? 'WHATSAPP_MESSAGE_FAILED' : input.status === 'DELIVERED' ? 'WHATSAPP_MESSAGE_DELIVERED' : 'WHATSAPP_MESSAGE_SENT',
      customerId: updated.customerId ?? null,
      metadata: {
        messageId: updated.id,
        conversationId: updated.conversationId,
        customerId: updated.customerId,
        entityType: updated.entityType,
        entityId: updated.entityId,
        provider: updated.provider,
        status: updated.status,
        messageType: updated.messageType,
      },
    }).catch(() => null)
    return updated
  }

  async markConversationResolved(orgId: string, conversationId: string) {
    this.logTransition('whatsapp.resolve', { orgId, conversationId, status: 'RESOLVED' })
    return this.prisma.whatsAppConversation.updateMany({ where: { id: conversationId, orgId }, data: { status: WhatsAppConversationStatus.RESOLVED } })
  }

  async markConversationPending(orgId: string, conversationId: string) {
    return this.prisma.whatsAppConversation.updateMany({ where: { id: conversationId, orgId }, data: { status: WhatsAppConversationStatus.WAITING_OPERATOR } })
  }

  async updateConversationStatus(orgId: string, conversationId: string, status: WhatsAppConversationStatus) {
    return this.prisma.whatsAppConversation.updateMany({
      where: { id: conversationId, orgId },
      data: { status },
    })
  }

  async retryFailedMessage(orgId: string, messageId: string) {
    const message = await this.prisma.whatsAppMessage.findFirst({ where: { id: messageId, orgId } })
    if (!message) throw new BadRequestException('Mensagem não encontrada')
    if (message.status !== 'FAILED') {
      throw new BadRequestException('Apenas mensagens com status FAILED podem ser reenviadas')
    }

    await this.prisma.whatsAppMessage.update({ where: { id: messageId }, data: { status: 'QUEUED', failedAt: null, errorMessage: null, errorCode: null } })
    await this.queueService.addJob(QUEUE_NAMES.WHATSAPP, 'dispatch-message', { messageId }, { jobId: `whatsapp:dispatch:retry:${messageId}` })
    await this.logMessageTimelineEventOnce({
      orgId,
      messageId,
      action: 'MESSAGE_RETRY_REQUESTED',
      errorMessage: message.errorMessage ?? null,
    })
    return { ok: true, messageId }
  }

  async processInboundWebhook(providerName: string, payload: unknown) {
    const provider = createWhatsAppProvider()
    const parsed = provider.parseWebhook(payload)

    const results: any[] = []
    for (const item of parsed) {
      if (item.eventType !== 'MESSAGE_RECEIVED' && item.providerMessageId) {
        const status = item.eventType === 'MESSAGE_DELIVERED' ? 'DELIVERED' : item.eventType === 'MESSAGE_READ' ? 'READ' : item.eventType === 'MESSAGE_FAILED' ? 'FAILED' : null
        if (status) {
          const existing = await this.prisma.whatsAppMessage.findFirst({ where: { providerMessageId: item.providerMessageId } })
          if (existing) {
            await this.logMessageTimelineEventOnce({ orgId: existing.orgId, messageId: existing.id, action: item.eventType })
            await this.updateMessageStatus(existing.orgId, { id: existing.id, status: status as WhatsAppMessageStatus, errorMessage: item.content ?? undefined })
            results.push({ associated: true, updatedMessageId: existing.id, eventType: item.eventType })
            continue
          }
        }
      }
      const phone = normalizePhone(item.fromPhone)
      const customer = phone
        ? await this.prisma.customer.findFirst({ where: { phone }, select: { id: true, orgId: true, phone: true } })
        : null

      const orgId = customer?.orgId ?? null
      if (!orgId) {
        results.push({ associated: false, reason: 'customer_not_found', phone })
        continue
      }

      const conversation = await this.resolveOrCreateConversation(orgId, customer.id, customer.phone, {
        contextType: 'CUSTOMER',
        contextId: customer.id,
      })

      const duplicated = item.providerMessageId
        ? await this.prisma.whatsAppMessage.findFirst({ where: { orgId, providerMessageId: item.providerMessageId } })
        : null
      if (duplicated) {
        await this.logMessageTimelineEventOnce({ orgId, messageId: duplicated.id, action: item.eventType })
        results.push({ associated: true, orgId, customerId: customer.id, messageId: duplicated.id, duplicated: true })
        continue
      }

      const message = await this.prisma.whatsAppMessage.create({
        data: {
          orgId,
          conversationId: conversation.id,
          customerId: customer.id,
          direction: 'INBOUND',
          entityType: 'CUSTOMER',
          entityId: customer.id,
          messageType: 'MANUAL',
          toPhone: conversation.phone,
          fromPhone: phone,
          renderedText: item.content ?? '',
          content: item.content ?? '',
          status: 'DELIVERED',
          provider: providerName,
          providerMessageId: item.providerMessageId,
          metadata: (item.metadata ?? null) as Prisma.InputJsonValue,
          deliveredAt: item.timestamp ?? new Date(),
        },
      })

      await this.touchConversation(conversation.id, {
        unreadCountIncrement: 1,
        lastMessageAt: message.createdAt,
        lastInboundAt: message.createdAt,
        status: WhatsAppConversationStatus.WAITING_OPERATOR,
      })
      this.logTransition('whatsapp.inbound', { orgId, conversationId: conversation.id, messageId: message.id, status: 'WAITING_OPERATOR' })

      await this.logMessageTimelineEventOnce({ orgId, messageId: message.id, action: 'MESSAGE_RECEIVED' })

      results.push({ associated: true, orgId, customerId: customer.id, messageId: message.id })
    }

    return { provider: providerName, processed: results.length, results }
  }

  private calculateInboxPriority(item: { status: WhatsAppConversationStatus; lastInboundAt: Date | null; lastOutboundAt: Date | null; updatedAt: Date }, signals: { hasPendingCharge: boolean; hasOverdueCharge: boolean; failedMessageCount: number }): WhatsAppConversationPriority {
    const hasNoResponse = Boolean(item.lastInboundAt && (!item.lastOutboundAt || item.lastInboundAt > item.lastOutboundAt))
    if (item.status === WhatsAppConversationStatus.RESOLVED) return 'LOW'
    if ((signals.hasOverdueCharge && hasNoResponse) || item.status === WhatsAppConversationStatus.FAILED || signals.failedMessageCount >= 2) return 'CRITICAL'
    if (signals.hasPendingCharge || hasNoResponse) return 'HIGH'
    return 'NORMAL'
  }

  private resolveNextAction(input: { failedMessageCount: number; hasPendingCharge: boolean; hasUpcomingAppointment: boolean; hasActiveServiceOrder: boolean }) {
    if (input.failedMessageCount > 0) return 'RETRY_MESSAGE'
    if (input.hasPendingCharge) return 'SEND_PAYMENT_REMINDER'
    if (input.hasUpcomingAppointment) return 'CONFIRM_APPOINTMENT'
    if (input.hasActiveServiceOrder) return 'SEND_SERVICE_UPDATE'
    return 'SEND_SERVICE_UPDATE'
  }

  async buildConversationFromCustomer(orgId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({ where: { orgId, id: customerId } })
    if (!customer) throw new BadRequestException('Cliente não encontrado')

    return this.resolveOrCreateConversation(orgId, customer.id, customer.phone, {
      contextType: 'CUSTOMER',
      contextId: customer.id,
    })
  }

  async resolveOrCreateConversation(
    orgId: string,
    customerId: string | null,
    phone: string,
    context: { contextType?: WhatsAppContextType | WhatsAppEntityType | string; contextId?: string | null },
  ) {
    const normalizedContextType = this.toContextType(context.contextType)

    const normalizedPhone = normalizePhone(phone)

    const existing = await this.prisma.whatsAppConversation.findFirst({
      where: {
        orgId,
        OR: [
          customerId ? { customerId } : undefined,
          normalizedPhone ? { phone: normalizedPhone } : undefined,
        ].filter(Boolean) as Prisma.WhatsAppConversationWhereInput[],
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (existing) return existing

    return this.prisma.whatsAppConversation.create({
      data: {
        orgId,
        customerId,
        phone: normalizedPhone ?? phone,
        title: null,
        contextType: normalizedContextType,
        contextId: context.contextId ?? null,
        status: WhatsAppConversationStatus.WAITING_OPERATOR,
        priority: 'NORMAL',
      },
    })
  }

  // Compat methods used elsewhere
  async findById(id: string) {
    return this.prisma.whatsAppMessage.findUnique({ where: { id } })
  }

  async getMessagesFeed(params: { orgId: string; customerId: string; limit?: number; cursor?: string }) {
    const conversation = await this.prisma.whatsAppConversation.findFirst({ where: { orgId: params.orgId, customerId: params.customerId } })
    if (!conversation) return { items: [], nextCursor: null }
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100)

    const rows = await this.prisma.whatsAppMessage.findMany({
      where: { orgId: params.orgId, conversationId: conversation.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      take: limit + 1,
    })
    const hasMore = rows.length > limit
    const sliced = hasMore ? rows.slice(0, limit) : rows
    return { items: sliced, nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null }
  }

  async queueMessage(input: {
    orgId: string
    customerId: string
    toPhone: string
    entityType: WhatsAppEntityType
    entityId: string
    messageType: WhatsAppMessageType
    messageKey: string
    renderedText: string
  }) {
    return this.enqueueMessage(input.orgId, {
      ...input,
      content: input.renderedText,
      conversationId: null,
    })
  }

  async claimQueued(params: { limit?: number; workerId: string }) {
    return this.prisma.whatsAppMessage.findMany({ where: { status: 'QUEUED' }, take: params.limit ?? 50, orderBy: { createdAt: 'asc' } })
  }

  async markSent(params: { id: string; provider: string; providerMessageId: string }) {
    const updated = await this.prisma.whatsAppMessage.update({
      where: { id: params.id },
      data: {
        status: 'SENT',
        provider: params.provider,
        providerMessageId: params.providerMessageId,
        sentAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    })
    await this.logMessageTimelineEventOnce({
      orgId: updated.orgId,
      messageId: updated.id,
      action: 'MESSAGE_SENT',
    })
    const byTypeAction = this.getMessageTypeTimelineAction(updated.messageType)
    if (byTypeAction) {
      await this.logMessageTimelineEventOnce({
        orgId: updated.orgId,
        messageId: updated.id,
        action: byTypeAction,
      })
    }
    return updated
  }

  async markFailedTerminal(params: { id: string; provider: string; errorCode: string; errorMessage: string }) {
    const updated = await this.prisma.whatsAppMessage.update({ where: { id: params.id }, data: { status: 'FAILED', provider: params.provider, errorCode: params.errorCode, errorMessage: params.errorMessage, failedAt: new Date() } })
    await this.logMessageTimelineEventOnce({
      orgId: updated.orgId,
      messageId: updated.id,
      action: 'MESSAGE_FAILED',
      errorMessage: updated.errorMessage ?? params.errorMessage,
    })
    return updated
  }

  async markFailedAndRequeue(params: { id: string; provider: string; errorCode: string; errorMessage: string }) {
    return this.prisma.whatsAppMessage.update({ where: { id: params.id }, data: { status: 'QUEUED', provider: params.provider, errorCode: params.errorCode, errorMessage: params.errorMessage } })
  }


  async createWebhookEvent(input: { provider: string; eventType: string; payload: Prisma.InputJsonValue }) {
    return this.prisma.whatsAppWebhookEvent.create({
      data: {
        provider: input.provider,
        eventType: input.eventType,
        payload: input.payload,
        status: 'RECEIVED',
      },
    })
  }

  async completeWebhookEvent(id: string, data: { status: 'PROCESSED' | 'FAILED'; orgId?: string | null; errorMessage?: string | null }) {
    return this.prisma.whatsAppWebhookEvent.update({
      where: { id },
      data: {
        status: data.status,
        orgId: data.orgId ?? undefined,
        errorMessage: data.errorMessage ?? null,
        processedAt: data.status === 'PROCESSED' ? new Date() : undefined,
      },
    })
  }
  private toContextType(value: string | undefined): WhatsAppContextType {
    const raw = String(value ?? 'GENERAL').toUpperCase()
    if (raw in {
      CUSTOMER: 1,
      APPOINTMENT: 1,
      SERVICE_ORDER: 1,
      CHARGE: 1,
      PAYMENT: 1,
      GENERAL: 1,
    }) return raw as WhatsAppContextType
    return 'GENERAL'
  }

  private async touchConversation(
    conversationId: string,
    input: { unreadCountIncrement?: number; lastMessageAt?: Date; lastInboundAt?: Date; lastOutboundAt?: Date; status?: WhatsAppConversationStatus; lastEventTimestamp?: Date },
  ) {
    await this.prisma.whatsAppConversation.updateMany({
      where: { id: conversationId, ...(input.lastEventTimestamp ? { updatedAt: { lt: input.lastEventTimestamp } } : {}) },
      data: {
        unreadCount: input.unreadCountIncrement ? { increment: input.unreadCountIncrement } : undefined,
        lastMessageAt: input.lastMessageAt,
        lastInboundAt: input.lastInboundAt,
        lastOutboundAt: input.lastOutboundAt,
        status: input.status,
      },
    })
  }

  private getMessageTypeTimelineAction(messageType: WhatsAppMessageType | null | undefined): string | null {
    if (messageType === 'PAYMENT_LINK') return 'PAYMENT_LINK_SENT'
    if (messageType === 'APPOINTMENT_REMINDER') return 'APPOINTMENT_REMINDER_SENT'
    if (messageType === 'SERVICE_UPDATE') return 'SERVICE_UPDATE_SENT'
    return null
  }

  private async logMessageTimelineEventOnce(input: {
    orgId: string
    messageId: string
    action: string
    errorMessage?: string | null
  }) {
    const message = await this.prisma.whatsAppMessage.findFirst({
      where: { id: input.messageId, orgId: input.orgId },
    })
    if (!message) return null

    const existing = await this.prisma.timelineEvent.findFirst({
      where: {
        orgId: input.orgId,
        action: input.action,
        metadata: {
          path: ['messageId'],
          equals: input.messageId,
        },
      },
      select: { id: true },
    })
    if (existing?.id) return null

    const communicationSignal = await buildCommunicationFailureSignal(this.prisma, {
      orgId: input.orgId,
      customerId: message.customerId ?? null,
    })

    return this.timeline.log({
      orgId: input.orgId,
      action: input.action,
      customerId: message.customerId ?? null,
      metadata: {
        messageId: message.id,
        providerMessageId: message.providerMessageId ?? null,
        messageType: message.messageType ?? null,
        errorMessage: input.errorMessage ?? message.errorMessage ?? null,
        entityType: message.entityType ?? null,
        entityId: message.entityId ?? null,
        customerId: message.customerId ?? null,
        governanceSignal: communicationSignal,
        conversationId: message.conversationId ?? null,
        direction: message.direction ?? null,
        status: message.status ?? null,
      },
    }).catch(() => null)
  }
}
