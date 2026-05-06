import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, WhatsAppConversationStatus, WhatsAppSuggestedAction } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { WhatsAppService } from './whatsapp.service'

type RequestExecutionInput = {
  orgId: string
  conversationId: string
  suggestedAction: WhatsAppSuggestedAction
  requestedBy?: string | null
  executionReason?: string | null
  actionPayload?: Record<string, unknown> | null
  idempotencyKey?: string | null
  autoExecuteSafe?: boolean
}

type ActorInput = { orgId: string; executionId: string; actorUserId?: string | null; reason?: string | null }

const CUSTOMER_FACING_ACTIONS = new Set<WhatsAppSuggestedAction>([
  'SEND_PAYMENT_LINK',
  'CONFIRM_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT',
  'SEND_SERVICE_UPDATE',
  'REPLY_WITH_TEMPLATE',
])

const LOW_RISK_AUTO_ACTIONS = new Set<WhatsAppSuggestedAction>([
  'ESCALATE_TO_OPERATOR',
  'MARK_RESOLVED',
])

const EXECUTABLE_ACTIONS = new Set<WhatsAppSuggestedAction>([
  'SEND_PAYMENT_LINK',
  'CONFIRM_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT',
  'SEND_SERVICE_UPDATE',
  'ESCALATE_TO_OPERATOR',
  'MARK_RESOLVED',
  'REPLY_WITH_TEMPLATE',
])

@Injectable()
export class WhatsAppExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  requiresApproval(action: WhatsAppSuggestedAction) {
    if (action === 'SEND_PAYMENT_LINK' || action === 'RESCHEDULE_APPOINTMENT') return true
    if (CUSTOMER_FACING_ACTIONS.has(action)) return true
    return !LOW_RISK_AUTO_ACTIONS.has(action)
  }

  async requestExecution(input: RequestExecutionInput) {
    this.assertExecutableAction(input.suggestedAction)
    const conversation = await this.getConversation(input.orgId, input.conversationId)
    const approvalRequired = this.requiresApproval(input.suggestedAction)
    const idempotencyKey = this.buildIdempotencyKey(input)

    const existing = await this.prisma.whatsAppActionExecution.findFirst({
      where: { orgId: input.orgId, idempotencyKey },
    })
    if (existing) return existing

    const execution = await this.prisma.whatsAppActionExecution.create({
      data: {
        orgId: input.orgId,
        conversationId: conversation.id,
        suggestedAction: input.suggestedAction,
        status: approvalRequired ? 'PENDING_APPROVAL' : 'APPROVED',
        approvalRequired,
        approvedBy: approvalRequired ? null : input.requestedBy ?? null,
        approvedAt: approvalRequired ? null : new Date(),
        executionReason: input.executionReason ?? null,
        actionPayload: this.toJson(input.actionPayload ?? {}),
        idempotencyKey,
      },
    })

    await this.writeAudit({
      orgId: input.orgId,
      actorUserId: input.requestedBy ?? null,
      action: approvalRequired ? 'whatsapp.action.pending_approval' : 'whatsapp.action.safe_auto_approved',
      execution,
      conversation,
      context: `Workflow WhatsApp criado para ${input.suggestedAction}`,
    })

    if (!approvalRequired && input.autoExecuteSafe !== false) {
      return this.execute({ orgId: input.orgId, executionId: execution.id, actorUserId: input.requestedBy ?? null })
    }

    return execution
  }

  async approve(input: ActorInput) {
    const execution = await this.getExecution(input.orgId, input.executionId)
    if (execution.status === 'EXECUTED') return execution
    if (execution.status === 'CANCELLED') throw new ConflictException('Execução cancelada não pode ser aprovada')
    if (execution.status === 'FAILED') throw new ConflictException('Execução falha não pode ser aprovada')

    const approved = await this.prisma.whatsAppActionExecution.update({
      where: { id: execution.id },
      data: {
        status: 'APPROVED',
        approvedBy: input.actorUserId ?? null,
        approvedAt: new Date(),
        executionReason: input.reason ?? execution.executionReason,
      },
    })
    const conversation = await this.getConversation(input.orgId, approved.conversationId)
    await this.logStateEvent('WHATSAPP_ACTION_APPROVED', approved, conversation, input.actorUserId ?? null, input.reason)
    await this.writeAudit({ orgId: input.orgId, actorUserId: input.actorUserId ?? null, action: 'whatsapp.action.approved', execution: approved, conversation, context: `Workflow WhatsApp aprovado: ${approved.suggestedAction}` })
    return approved
  }

  async execute(input: ActorInput) {
    const execution = await this.getExecution(input.orgId, input.executionId)
    if (execution.status === 'EXECUTED') return execution
    if (execution.status === 'PENDING_APPROVAL') throw new ConflictException('Execução exige aprovação humana antes de executar')
    if (execution.status === 'CANCELLED') throw new ConflictException('Execução cancelada não pode ser executada')

    const conversation = await this.getConversation(input.orgId, execution.conversationId)
    try {
      const result = await this.executeAction(execution, conversation, input.actorUserId ?? null)
      const updated = await this.prisma.whatsAppActionExecution.update({
        where: { id: execution.id },
        data: {
          status: 'EXECUTED',
          executedBy: input.actorUserId ?? null,
          executedAt: new Date(),
          executionResult: this.toJson(result),
          failureReason: null,
        },
      })
      await this.logStateEvent('WHATSAPP_ACTION_EXECUTED', updated, conversation, input.actorUserId ?? null, input.reason, result)
      await this.writeAudit({ orgId: input.orgId, actorUserId: input.actorUserId ?? null, action: 'whatsapp.action.executed', execution: updated, conversation, context: `Workflow WhatsApp executado: ${updated.suggestedAction}`, result })
      return updated
    } catch (error: any) {
      const failed = await this.prisma.whatsAppActionExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          executedBy: input.actorUserId ?? null,
          failedAt: new Date(),
          failureReason: String(error?.message ?? 'Falha ao executar workflow'),
          executionResult: this.toJson({ ok: false, error: String(error?.message ?? error) }),
        },
      })
      await this.logStateEvent('WHATSAPP_ACTION_FAILED', failed, conversation, input.actorUserId ?? null, input.reason, { ok: false, error: failed.failureReason })
      await this.writeAudit({ orgId: input.orgId, actorUserId: input.actorUserId ?? null, action: 'whatsapp.action.failed', execution: failed, conversation, context: `Workflow WhatsApp falhou: ${failed.suggestedAction}`, result: { error: failed.failureReason } })
      return failed
    }
  }

  async cancel(input: ActorInput) {
    const execution = await this.getExecution(input.orgId, input.executionId)
    if (execution.status === 'EXECUTED') throw new ConflictException('Execução já executada não pode ser cancelada')
    if (execution.status === 'CANCELLED') return execution
    const cancelled = await this.prisma.whatsAppActionExecution.update({
      where: { id: execution.id },
      data: { status: 'CANCELLED', cancelledBy: input.actorUserId ?? null, cancelledAt: new Date(), executionReason: input.reason ?? execution.executionReason },
    })
    const conversation = await this.getConversation(input.orgId, cancelled.conversationId)
    await this.logStateEvent('WHATSAPP_ACTION_CANCELLED', cancelled, conversation, input.actorUserId ?? null, input.reason)
    await this.writeAudit({ orgId: input.orgId, actorUserId: input.actorUserId ?? null, action: 'whatsapp.action.cancelled', execution: cancelled, conversation, context: `Workflow WhatsApp cancelado: ${cancelled.suggestedAction}` })
    return cancelled
  }

  async listPendingApprovals(orgId: string, limit = 50) {
    return this.prisma.whatsAppActionExecution.findMany({
      where: { orgId, status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'asc' },
      take: Math.max(1, Math.min(Number(limit) || 50, 200)),
      include: { conversation: { select: { id: true, customerId: true, phone: true, title: true, priority: true, intent: true } } },
    })
  }

  async listHistory(orgId: string, conversationId?: string, limit = 100) {
    return this.prisma.whatsAppActionExecution.findMany({
      where: { orgId, ...(conversationId ? { conversationId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(Number(limit) || 100, 500)),
    })
  }

  async getStatus(orgId: string, executionId: string) {
    return this.getExecution(orgId, executionId)
  }

  private async executeAction(execution: any, conversation: any, actorUserId: string | null) {
    const payload = (execution.actionPayload ?? {}) as Record<string, any>
    const entity = this.resolveEntity(execution, conversation, payload)
    switch (execution.suggestedAction as WhatsAppSuggestedAction) {
      case 'ESCALATE_TO_OPERATOR':
        await this.prisma.whatsAppConversation.updateMany({ where: { id: conversation.id, orgId: execution.orgId }, data: { status: WhatsAppConversationStatus.WAITING_OPERATOR } })
        return { ok: true, status: 'WAITING_OPERATOR' }
      case 'MARK_RESOLVED':
        await this.whatsapp.updateConversationStatus(execution.orgId, conversation.id, WhatsAppConversationStatus.RESOLVED)
        return { ok: true, status: 'RESOLVED' }
      case 'SEND_PAYMENT_LINK':
        if (!payload.paymentLink) throw new BadRequestException('paymentLink é obrigatório para SEND_PAYMENT_LINK')
        return this.whatsapp.sendTemplateMessage(execution.orgId, actorUserId, { conversationId: conversation.id, customerId: conversation.customerId, templateKey: 'payment_link', context: payload, entityType: 'CHARGE', entityId: entity.entityId, messageType: 'PAYMENT_LINK' })
      case 'CONFIRM_APPOINTMENT':
        await this.updateAppointment(execution.orgId, entity.entityId, { status: 'CONFIRMED' })
        return this.whatsapp.sendTemplateMessage(execution.orgId, actorUserId, { conversationId: conversation.id, customerId: conversation.customerId, templateKey: 'appointment_confirmation', context: payload, entityType: 'APPOINTMENT', entityId: entity.entityId, messageType: 'APPOINTMENT_CONFIRMATION' })
      case 'RESCHEDULE_APPOINTMENT':
        if (!payload.startsAt) throw new BadRequestException('startsAt é obrigatório para RESCHEDULE_APPOINTMENT')
        await this.updateAppointment(execution.orgId, entity.entityId, { startsAt: new Date(String(payload.startsAt)), ...(payload.endsAt ? { endsAt: new Date(String(payload.endsAt)) } : {}) })
        return this.whatsapp.sendManualMessage(execution.orgId, actorUserId, { conversationId: conversation.id, customerId: conversation.customerId, content: String(payload.content ?? 'Seu agendamento foi reagendado.'), entityType: 'APPOINTMENT', entityId: entity.entityId, messageType: 'APPOINTMENT_REMINDER' })
      case 'SEND_SERVICE_UPDATE':
        return this.whatsapp.sendTemplateMessage(execution.orgId, actorUserId, { conversationId: conversation.id, customerId: conversation.customerId, templateKey: 'service_update', context: payload, entityType: 'SERVICE_ORDER', entityId: entity.entityId, messageType: 'SERVICE_UPDATE' })
      case 'REPLY_WITH_TEMPLATE':
        if (!payload.templateKey) throw new BadRequestException('templateKey é obrigatório para REPLY_WITH_TEMPLATE')
        return this.whatsapp.sendTemplateMessage(execution.orgId, actorUserId, { conversationId: conversation.id, customerId: conversation.customerId, templateKey: String(payload.templateKey), context: payload.context ?? payload, entityType: entity.entityType, entityId: entity.entityId })
      default:
        throw new BadRequestException('Ação sugerida não executável')
    }
  }

  private resolveEntity(execution: any, conversation: any, payload: Record<string, any>) {
    const entityType = String(payload.entityType ?? conversation.contextType ?? 'GENERAL')
    const entityId = String(payload.entityId ?? conversation.contextId ?? conversation.customerId ?? conversation.id)
    if (!entityId) throw new BadRequestException('Entidade operacional não encontrada para execução')
    return { entityType, entityId }
  }

  private async updateAppointment(orgId: string, appointmentId: string, data: Record<string, unknown>) {
    const result = await this.prisma.appointment.updateMany({ where: { id: appointmentId, orgId }, data })
    if (result.count !== 1) throw new BadRequestException('Agendamento inválido para este tenant')
  }

  private async getConversation(orgId: string, conversationId: string) {
    const conversation = await this.prisma.whatsAppConversation.findFirst({ where: { id: conversationId, orgId } })
    if (!conversation) throw new NotFoundException('Conversa WhatsApp não encontrada para este tenant')
    return conversation
  }

  private async getExecution(orgId: string, executionId: string) {
    const execution = await this.prisma.whatsAppActionExecution.findFirst({ where: { id: executionId, orgId } })
    if (!execution) throw new NotFoundException('Execução WhatsApp não encontrada para este tenant')
    return execution
  }

  private assertExecutableAction(action: WhatsAppSuggestedAction) {
    if (!EXECUTABLE_ACTIONS.has(action)) throw new BadRequestException('Ação sugerida não suportada para execução')
  }

  private buildIdempotencyKey(input: RequestExecutionInput) {
    return String(input.idempotencyKey ?? '').trim() || ['whatsapp-action', input.orgId, input.conversationId, input.suggestedAction, JSON.stringify(input.actionPayload ?? {})].join(':')
  }

  private async logStateEvent(action: string, execution: any, conversation: any, actorUserId: string | null, reason?: string | null, result?: unknown) {
    await this.timeline.log({
      orgId: execution.orgId,
      action,
      description: `${execution.suggestedAction} => ${execution.status}`,
      customerId: conversation.customerId ?? null,
      appointmentId: this.timelineEntityId(execution, conversation, 'APPOINTMENT'),
      chargeId: this.timelineEntityId(execution, conversation, 'CHARGE'),
      serviceOrderId: this.timelineEntityId(execution, conversation, 'SERVICE_ORDER'),
      metadata: { executionId: execution.id, conversationId: conversation.id, suggestedAction: execution.suggestedAction, status: execution.status, actorUserId, reason: reason ?? null, result: result ?? execution.executionResult ?? null, approvalRequired: execution.approvalRequired },
    })
  }

  private timelineEntityId(execution: any, conversation: any, expected: string) {
    const payload = (execution.actionPayload ?? {}) as Record<string, any>
    const type = String(payload.entityType ?? conversation.contextType ?? '')
    return type === expected ? String(payload.entityId ?? conversation.contextId ?? '') || undefined : undefined
  }

  private async writeAudit(input: { orgId: string; actorUserId: string | null; action: string; execution: any; conversation: any; context: string; result?: unknown }) {
    await this.prisma.auditEvent.create({
      data: {
        orgId: input.orgId,
        action: input.action,
        actorUserId: input.actorUserId,
        entityType: 'WHATSAPP_ACTION_EXECUTION',
        entityId: input.execution.id,
        context: input.context,
        metadata: this.toJson({ conversationId: input.conversation.id, suggestedAction: input.execution.suggestedAction, status: input.execution.status, result: input.result ?? null }),
      },
    })
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return (value ?? {}) as Prisma.InputJsonValue
  }
}
