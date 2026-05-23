import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { WhatsAppService } from '../whatsapp/whatsapp.service'
import { FinanceService } from '../finance/finance.service'
import { RiskService } from '../risk/risk.service'
import { GovernanceRunService } from '../governance/governance-run.service'

export type OperationalActionType = 'RETRY_WHATSAPP_MESSAGE' | 'SEND_PAYMENT_REMINDER' | 'RECALCULATE_RISK' | 'RUN_GOVERNANCE_CHECK'
export type OperationalActionStatus = 'REQUESTED' | 'EXECUTING' | 'EXECUTED' | 'FAILED' | 'CANCELED'

@Injectable()
export class OperationalActionsService {
  constructor(private readonly prisma: PrismaService, private readonly timeline: TimelineService, private readonly whatsapp: WhatsAppService, private readonly finance: FinanceService, private readonly risk: RiskService, private readonly governanceRun: GovernanceRunService) {}

  getSupportedActionTypes(): OperationalActionType[] { return ['RETRY_WHATSAPP_MESSAGE', 'SEND_PAYMENT_REMINDER', 'RECALCULATE_RISK', 'RUN_GOVERNANCE_CHECK'] }

  private resolveSourceKey(sourceSignalId?: string | null, metadata?: Record<string, unknown> | null) {
    if (sourceSignalId?.trim()) return sourceSignalId
    const metadataSignal = typeof metadata?.sourceSignalId === 'string' ? metadata.sourceSignalId.trim() : ''
    return metadataSignal || '__NO_SIGNAL__'
  }

  private buildLogicalKey(input: { actionType: OperationalActionType; entityType: string; entityId: string; sourceSignalId?: string | null; metadata?: Record<string, unknown> | null }) {
    return `${input.actionType}:${input.entityType}:${input.entityId}:${this.resolveSourceKey(input.sourceSignalId, input.metadata)}`
  }


  async request(input: { orgId: string; actorUserId: string; actionType: OperationalActionType; entityType: string; entityId: string; sourceSignalId?: string | null; metadata?: Record<string, unknown> | null }) {
    const { orgId, actorUserId, actionType, entityType, entityId, sourceSignalId, metadata } = input
    if (!orgId || !actorUserId) throw new BadRequestException('orgId/actor obrigatórios')
    const requestedAt = new Date()
    const logicalKey = this.buildLogicalKey({ actionType, entityType, entityId, sourceSignalId, metadata })
    const existing = await this.prisma.operationalActionExecution.findFirst({ where: { orgId, logicalKey, status: 'REQUESTED' }, orderBy: { createdAt: 'desc' } })
    if (existing) return { actionType, entityType, entityId, status: 'REQUESTED' as OperationalActionStatus, requestedAt: existing.requestedAt.toISOString(), idempotent: true }

    try {
      await this.prisma.operationalActionExecution.create({ data: { orgId, actionType, entityType, entityId, sourceSignalId: sourceSignalId ?? null, logicalKey, status: 'REQUESTED', requestedAt, requestedByUserId: actorUserId, origin: 'dashboard', suggestedAction: typeof metadata?.suggestedAction === 'string' ? metadata.suggestedAction : null, relatedChargeId: typeof metadata?.relatedChargeId === 'string' ? metadata.relatedChargeId : null, relatedServiceOrderId: typeof metadata?.relatedServiceOrderId === 'string' ? metadata.relatedServiceOrderId : null, relatedMessageId: typeof metadata?.relatedMessageId === 'string' ? metadata.relatedMessageId : null, metadata: (metadata ?? {}) as Prisma.InputJsonValue } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await this.prisma.operationalActionExecution.findFirst({ where: { orgId, logicalKey, status: 'REQUESTED' }, orderBy: { createdAt: 'desc' } })
        if (duplicate) return { actionType, entityType, entityId, status: 'REQUESTED' as OperationalActionStatus, requestedAt: duplicate.requestedAt.toISOString(), idempotent: true }
      }
      throw error
    }

    await this.timeline.log({ orgId, action: 'OPERATIONAL_ACTION_REQUESTED', metadata: { actionType, entityType, entityId, requestedBy: actorUserId, actorUserId, sourceSignalId: sourceSignalId ?? null, logicalKey, origin: 'dashboard', requestedAt: requestedAt.toISOString(), status: 'REQUESTED', context: metadata ?? {} } })
    return { actionType, entityType, entityId, status: 'REQUESTED' as OperationalActionStatus, requestedAt: requestedAt.toISOString(), idempotent: false }
  }

  private buildExecutionWhere(input: { orgId: string; actionType: OperationalActionType; entityType: string; entityId: string; sourceSignalId?: string | null; metadata?: Record<string, unknown> | null }) {
    return { orgId: input.orgId, logicalKey: this.buildLogicalKey(input) }
  }

  private async findExecution(input: { orgId: string; actionType: OperationalActionType; entityType: string; entityId: string; sourceSignalId?: string | null; metadata?: Record<string, unknown> | null }) {
    return this.prisma.operationalActionExecution.findFirst({ where: this.buildExecutionWhere(input), orderBy: { createdAt: 'desc' } })
  }

  async execute(input: { orgId: string; actorUserId: string; actionType: OperationalActionType; entityType: string; sourceSignalId?: string | null; entityId: string; metadata?: Record<string, unknown> | null }) {
    const { orgId, actorUserId, actionType, entityType, sourceSignalId, entityId, metadata } = input
    if (!orgId || !actorUserId) throw new BadRequestException('orgId/actor obrigatórios')
    const execution = await this.findExecution({ orgId, actionType, entityType, entityId, sourceSignalId, metadata })
    if (!execution) throw new ConflictException('Ação precisa estar REQUESTED para executar')
    if (execution.status === 'EXECUTED') return { actionType, status: 'EXECUTED' as OperationalActionStatus, idempotent: true }
    if (execution.status !== 'REQUESTED') throw new ConflictException('Somente ação REQUESTED pode transicionar')

    const reserved = await this.prisma.operationalActionExecution.updateMany({ where: { id: execution.id, orgId, status: 'REQUESTED' }, data: { status: 'EXECUTING' } })
    if (reserved.count !== 1) throw new ConflictException('Ação já está em execução ou foi transicionada por outro operador')

    try {
      let result: Record<string, unknown>
      if (actionType === 'RETRY_WHATSAPP_MESSAGE') {
        const m = await this.prisma.whatsAppMessage.findFirst({ where: { id: entityId, orgId }, select: { id: true, status: true, customerId: true } })
        if (!m) throw new NotFoundException('Mensagem não encontrada para org')
        if (m.status !== 'FAILED') throw new BadRequestException('Retry permitido somente para FAILED')
        await this.whatsapp.retryFailedMessage(orgId, m.id)
        result = { messageId: m.id }
      } else if (actionType === 'SEND_PAYMENT_REMINDER') {
        const c = await this.prisma.charge.findFirst({ where: { id: entityId, orgId }, select: { id: true, status: true } })
        if (!c) throw new NotFoundException('Charge não encontrada para org')
        if (c.status === 'PAID' || c.status === 'CANCELED') throw new BadRequestException('Reminder bloqueado para PAID/CANCELED')
        await this.finance.remindChargeInOrg(orgId, c.id)
        result = { chargeId: c.id }
      } else if (actionType === 'RECALCULATE_RISK') {
        const p = await this.prisma.person.findFirst({ where: { id: entityId, orgId }, select: { id: true } })
        if (!p) throw new NotFoundException('Pessoa não encontrada para org')
        const risk = await this.risk.recalculatePersonRisk(p.id, 'OPERATIONAL_ACTION_ASSISTED_RECALCULATE_RISK', orgId)
        result = { personId: p.id, riskScore: risk.score, state: risk.state }
      } else {
        this.governanceRun.startRun(orgId)
        const governance = await this.governanceRun.finish(orgId)
        result = { governanceScore: governance.institutionalRiskScore }
      }
      await this.prisma.operationalActionExecution.update({ where: { id: execution.id }, data: { status: 'EXECUTED', executedAt: new Date(), executedByUserId: actorUserId } })
      await this.timeline.log({ orgId, action: 'OPERATIONAL_ACTION_EXECUTED', metadata: { actionType, entityType, sourceSignalId: sourceSignalId ?? null, entityId, actorUserId, logicalKey: execution.logicalKey, previousStatus: 'REQUESTED', nextStatus: 'EXECUTED', status: 'EXECUTED', ...result } })
      return { actionType, status: 'EXECUTED' as OperationalActionStatus, result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error'
      await this.prisma.operationalActionExecution.update({ where: { id: execution.id }, data: { status: 'FAILED', failedAt: new Date(), failureReason: message } })
      await this.timeline.log({ orgId, action: 'OPERATIONAL_ACTION_FAILED', metadata: { actionType, entityType, sourceSignalId: sourceSignalId ?? null, entityId, actorUserId, logicalKey: execution.logicalKey, previousStatus: 'EXECUTING', nextStatus: 'FAILED', status: 'FAILED', errorMessage: message } })
      throw error
    }
  }

  async cancel(input: { orgId: string; actorUserId: string; actionType: OperationalActionType; entityType: string; entityId: string; sourceSignalId?: string | null; metadata?: Record<string, unknown> | null }) {
    const { orgId, actorUserId, actionType, entityType, entityId, sourceSignalId } = input
    if (!orgId || !actorUserId) throw new BadRequestException('orgId/actor obrigatórios')
    const logicalKey = this.buildLogicalKey(input)
    const execution = await this.findExecution(input)
    if (!execution) throw new ConflictException('Somente ação REQUESTED pode ser cancelada')
    if (execution.status === 'CANCELED') return { actionType, entityType, entityId, status: 'CANCELED' as OperationalActionStatus, idempotent: true }
    if (execution.status !== 'REQUESTED') throw new ConflictException('Somente ação REQUESTED pode transicionar')

    const updated = await this.prisma.operationalActionExecution.updateMany({ where: { id: execution.id, orgId, status: 'REQUESTED' }, data: { status: 'CANCELED', canceledAt: new Date(), canceledByUserId: actorUserId } })
    if (updated.count !== 1) throw new ConflictException('Ação já foi transicionada por outro operador')

    await this.timeline.log({ orgId, action: 'OPERATIONAL_ACTION_CANCELED', metadata: { actionType, entityType, entityId, actorUserId, sourceSignalId: sourceSignalId ?? null, logicalKey, previousStatus: 'REQUESTED', nextStatus: 'CANCELED', status: 'CANCELED' } })
    return { actionType, entityType, entityId, status: 'CANCELED' as OperationalActionStatus, idempotent: false }
  }
}
