import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { WhatsAppService } from '../whatsapp/whatsapp.service'
import { FinanceService } from '../finance/finance.service'
import { RiskService } from '../risk/risk.service'
import { GovernanceRunService } from '../governance/governance-run.service'
import { Prisma } from '@prisma/client'

export type OperationalActionType = 'RETRY_WHATSAPP_MESSAGE' | 'SEND_PAYMENT_REMINDER' | 'RECALCULATE_RISK' | 'RUN_GOVERNANCE_CHECK'
export type OperationalActionStatus = 'REQUESTED' | 'EXECUTED' | 'FAILED' | 'CANCELED'


type OperationalActionExecutionRecord = {
  id: string
  status: OperationalActionStatus
}

@Injectable()
export class OperationalActionsService {
  constructor(private readonly prisma: PrismaService, private readonly timeline: TimelineService, private readonly whatsapp: WhatsAppService, private readonly finance: FinanceService, private readonly risk: RiskService, private readonly governanceRun: GovernanceRunService) {}
  getSupportedActionTypes(): OperationalActionType[] { return ['RETRY_WHATSAPP_MESSAGE', 'SEND_PAYMENT_REMINDER', 'RECALCULATE_RISK', 'RUN_GOVERNANCE_CHECK'] }
  async request(input: { orgId: string; actorUserId: string; actionType: OperationalActionType; entityType: string; entityId: string; sourceSignalId?: string | null; metadata?: Record<string, unknown> | null }) {
    const { orgId, actorUserId, actionType, entityType, entityId, sourceSignalId, metadata } = input
    if (!orgId || !actorUserId) throw new BadRequestException('orgId/actor obrigatórios')
    const requestedAt = new Date().toISOString()
    const requestMetadata = {
      actionType,
      entityType,
      entityId,
      requestedBy: actorUserId,
      actorUserId,
      sourceSignalId: sourceSignalId ?? null,
      origin: 'dashboard',
      suggestedAction: typeof metadata?.suggestedAction === 'string' ? metadata.suggestedAction : null,
      relatedChargeId: typeof metadata?.relatedChargeId === 'string' ? metadata.relatedChargeId : null,
      relatedServiceOrderId: typeof metadata?.relatedServiceOrderId === 'string' ? metadata.relatedServiceOrderId : null,
      relatedMessageId: typeof metadata?.relatedMessageId === 'string' ? metadata.relatedMessageId : null,
      requestedAt,
      status: 'REQUESTED' as OperationalActionStatus,
      context: metadata ?? {},
    }
    await this.prisma.operationalActionExecution.create({
      data: {
        orgId,
        actionType,
        entityType,
        entityId,
        sourceSignalId: sourceSignalId ?? null,
        status: 'REQUESTED',
        requestedAt: new Date(requestedAt),
        requestedByUserId: actorUserId,
        origin: 'dashboard',
        suggestedAction: typeof metadata?.suggestedAction === 'string' ? metadata.suggestedAction : null,
        relatedChargeId: typeof metadata?.relatedChargeId === 'string' ? metadata.relatedChargeId : null,
        relatedServiceOrderId: typeof metadata?.relatedServiceOrderId === 'string' ? metadata.relatedServiceOrderId : null,
        relatedMessageId: typeof metadata?.relatedMessageId === 'string' ? metadata.relatedMessageId : null,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    })
    await this.timeline.log({ orgId, action: 'OPERATIONAL_ACTION_REQUESTED', metadata: requestMetadata })
    return { actionType, entityType, entityId, status: 'REQUESTED' as OperationalActionStatus, requestedAt }
  }



  private assertValidTransition(currentStatus: OperationalActionStatus, nextStatus: OperationalActionStatus) {
    if (currentStatus !== 'REQUESTED') throw new ConflictException('Somente ação REQUESTED pode transicionar')
    if (nextStatus === 'REQUESTED') throw new ConflictException('REQUESTED não é transição válida')
  }

  private buildExecutionWhere(input: { orgId: string; actionType: OperationalActionType; entityId: string; sourceSignalId?: string | null }) {
    return {
      orgId: input.orgId,
      actionType: input.actionType,
      entityId: input.entityId,
      sourceSignalId: input.sourceSignalId ?? null,
    }
  }

  private async findExecution(input: { orgId: string; actionType: OperationalActionType; entityId: string; sourceSignalId?: string | null }): Promise<OperationalActionExecutionRecord | null> {
    return this.prisma.operationalActionExecution.findFirst({
      where: this.buildExecutionWhere(input),
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    })
  }

  async execute(input: { orgId: string; actorUserId: string; actionType: OperationalActionType; sourceSignalId?: string | null; entityId: string }) {
    const { orgId, actorUserId, actionType, sourceSignalId, entityId } = input
    if (!orgId || !actorUserId) throw new BadRequestException('orgId/actor obrigatórios')
    const baseMeta = { actionType, sourceSignalId: sourceSignalId ?? null, entityId, actorUserId }
    const execution = await this.findExecution({ orgId, actionType, entityId, sourceSignalId })
    if (!execution) throw new ConflictException('Ação precisa estar REQUESTED para executar')
    const previousStatus = execution.status
    this.assertValidTransition(previousStatus, 'EXECUTED')
    try {
      let result: Record<string, unknown>
      if (actionType === 'RETRY_WHATSAPP_MESSAGE') {
        const m = await this.prisma.whatsAppMessage.findFirst({ where: { id: entityId, orgId }, select: { id: true, status: true, customerId: true } })
        if (!m) throw new NotFoundException('Mensagem não encontrada para org')
        if (m.status !== 'FAILED') throw new BadRequestException('Retry permitido somente para FAILED')
        await this.whatsapp.retryFailedMessage(orgId, m.id)
        result = { messageId: m.id, customerId: m.customerId ?? null }
      } else if (actionType === 'SEND_PAYMENT_REMINDER') {
        const c = await this.prisma.charge.findFirst({ where: { id: entityId, orgId }, select: { id: true, status: true, customerId: true } })
        if (!c) throw new NotFoundException('Charge não encontrada para org')
        if (c.status === 'PAID' || c.status === 'CANCELED') throw new BadRequestException('Reminder bloqueado para PAID/CANCELED')
        await this.finance.remindChargeInOrg(orgId, c.id)
        result = { chargeId: c.id, customerId: c.customerId ?? null }
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
      await this.prisma.operationalActionExecution.update({
        where: { id: execution.id },
        data: { status: 'EXECUTED', executedAt: new Date(), executedByUserId: actorUserId },
      })
      await this.timeline.log({ orgId, action: 'OPERATIONAL_ACTION_EXECUTED', metadata: { ...baseMeta, previousStatus, nextStatus: 'EXECUTED', status: 'EXECUTED', ...result } })
      return { actionType, status: 'EXECUTED' as OperationalActionStatus, result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error'
      await this.prisma.operationalActionExecution.update({
        where: { id: execution.id },
        data: { status: 'FAILED', failedAt: new Date(), failureReason: message },
      })
      await this.timeline.log({ orgId, action: 'OPERATIONAL_ACTION_FAILED', metadata: { ...baseMeta, previousStatus, nextStatus: 'FAILED', status: 'FAILED', errorMessage: message } })
      throw error
    }
  }

  async cancel(input: { orgId: string; actorUserId: string; actionType: OperationalActionType; entityType: string; entityId: string; sourceSignalId?: string | null; metadata?: Record<string, unknown> | null }) {
    const { orgId, actorUserId, actionType, entityType, entityId, sourceSignalId, metadata } = input
    if (!orgId || !actorUserId) throw new BadRequestException('orgId/actor obrigatórios')
    const execution = await this.findExecution({ orgId, actionType, entityId, sourceSignalId })
    if (!execution) throw new ConflictException('Somente ação REQUESTED pode ser cancelada')
    const previousStatus = execution.status
    this.assertValidTransition(previousStatus, 'CANCELED')
    const canceledAt = new Date().toISOString()
    await this.prisma.operationalActionExecution.update({
      where: { id: execution.id },
      data: { status: 'CANCELED', canceledAt: new Date(canceledAt), canceledByUserId: actorUserId },
    })
    await this.timeline.log({
      orgId,
      action: 'OPERATIONAL_ACTION_CANCELED',
      metadata: {
        actionType,
        entityType,
        entityId,
        canceledBy: actorUserId,
        actorUserId,
        canceledAt,
        sourceSignalId: sourceSignalId ?? null,
        origin: 'dashboard',
        suggestedAction: typeof metadata?.suggestedAction === 'string' ? metadata.suggestedAction : null,
        relatedChargeId: typeof metadata?.relatedChargeId === 'string' ? metadata.relatedChargeId : null,
        relatedServiceOrderId: typeof metadata?.relatedServiceOrderId === 'string' ? metadata.relatedServiceOrderId : null,
        relatedMessageId: typeof metadata?.relatedMessageId === 'string' ? metadata.relatedMessageId : null,
        previousStatus,
        nextStatus: 'CANCELED',
        status: 'CANCELED' as OperationalActionStatus,
      },
    })
    return { actionType, entityType, entityId, status: 'CANCELED' as OperationalActionStatus, canceledAt }
  }

}
