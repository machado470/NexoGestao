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
import { QUEUE_NAMES } from '../queue/queue.constants'
import { TimelineService } from '../timeline/timeline.service'
import { RequestContextService } from '../common/context/request-context.service'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'
import { CommercialPolicyService, isCommercialBlocked } from '../common/commercial/commercial-policy.service'
import { createWhatsAppProvider } from './providers/provider.factory'
import { WhatsAppTemplateService } from './whatsapp-template.service'
import { WhatsAppContextService } from './whatsapp-context.service'

export function buildDeterministicMessageKey(input: { entityType: WhatsAppEntityType; entityId: string; messageType: WhatsAppMessageType }) {
  return `${input.entityType}:${input.entityId}:${input.messageType}`
}

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
    private readonly templateService?: WhatsAppTemplateService,
    private readonly contextService?: WhatsAppContextService,
  ) {}

  async listConversations(orgId: string, filters: any = {}) {
    const statusFilter =
      filters.status
      ?? (filters.onlyFailed ? 'FAILED' : undefined)
      ?? (filters.onlyPending ? 'PENDING' : undefined)

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

    return this.prisma.whatsAppConversation.findMany({
      where,
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: [
        { priority: 'desc' },
        { unreadCount: 'desc' },
        { status: 'asc' },
        { lastMessageAt: 'desc' },
      ],
    })
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

    const toPhone = String(input.toPhone ?? customer?.phone ?? '').trim()
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
    })

    await this.queueService.addJob(QUEUE_NAMES.WHATSAPP, 'dispatch-message', { messageId: message.id }, { jobId: `whatsapp:dispatch:${message.id}` })

    this.tenantOps.increment(orgId, 'whatsapp_queued')
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
    return this.prisma.whatsAppConversation.updateMany({ where: { id: conversationId, orgId }, data: { status: 'RESOLVED' } })
  }

  async markConversationPending(orgId: string, conversationId: string) {
    return this.prisma.whatsAppConversation.updateMany({ where: { id: conversationId, orgId }, data: { status: 'PENDING' } })
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
    return { ok: true, messageId }
  }

  async processInboundWebhook(providerName: string, payload: unknown) {
    const provider = createWhatsAppProvider()
    const parsed = provider.parseWebhook(payload)

    const results: any[] = []
    for (const item of parsed) {
      const phone = this.normalizePhone(item.fromPhone)
      const customer = phone
        ? await this.prisma.customer.findFirst({ where: { phone: { contains: phone.slice(-8) } }, select: { id: true, orgId: true, phone: true } })
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
      })

      await this.timeline.log({
        orgId,
        action: 'WHATSAPP_INBOUND_RECEIVED',
        customerId: customer.id,
        metadata: {
          messageId: message.id,
          conversationId: conversation.id,
          customerId: customer.id,
          entityType: message.entityType,
          entityId: message.entityId,
          provider: providerName,
          status: message.status,
          messageType: message.messageType,
        },
      }).catch(() => null)

      results.push({ associated: true, orgId, customerId: customer.id, messageId: message.id })
    }

    return { provider: providerName, processed: results.length, results }
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

    const normalizedPhone = this.normalizePhone(phone)
    const phoneTail = normalizedPhone?.slice(-8) ?? null

    const existing = await this.prisma.whatsAppConversation.findFirst({
      where: {
        orgId,
        OR: [
          customerId ? { customerId } : undefined,
          { phone },
          normalizedPhone ? { phone: normalizedPhone } : undefined,
          phoneTail ? { phone: { endsWith: phoneTail } } : undefined,
        ].filter(Boolean) as Prisma.WhatsAppConversationWhereInput[],
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (existing) return existing

    return this.prisma.whatsAppConversation.create({
      data: {
        orgId,
        customerId,
        phone,
        title: null,
        contextType: normalizedContextType,
        contextId: context.contextId ?? null,
        status: 'OPEN',
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
    return this.prisma.whatsAppMessage.update({
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
  }

  async markFailedTerminal(params: { id: string; provider: string; errorCode: string; errorMessage: string }) {
    return this.prisma.whatsAppMessage.update({ where: { id: params.id }, data: { status: 'FAILED', provider: params.provider, errorCode: params.errorCode, errorMessage: params.errorMessage, failedAt: new Date() } })
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

  private normalizePhone(phone: string | null): string | null {
    if (!phone) return null
    const digits = phone.replace(/\D/g, '')
    return digits || null
  }

  private async touchConversation(
    conversationId: string,
    input: { unreadCountIncrement?: number; lastMessageAt?: Date; lastInboundAt?: Date; lastOutboundAt?: Date },
  ) {
    await this.prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        unreadCount: input.unreadCountIncrement ? { increment: input.unreadCountIncrement } : undefined,
        lastMessageAt: input.lastMessageAt,
        lastInboundAt: input.lastInboundAt,
        lastOutboundAt: input.lastOutboundAt,
      },
    })
  }
}
