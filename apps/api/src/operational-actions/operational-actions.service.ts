import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { WhatsAppService } from '../whatsapp/whatsapp.service'
import { FinanceService } from '../finance/finance.service'
import { RiskService } from '../risk/risk.service'
import { GovernanceRunService } from '../governance/governance-run.service'

export type OperationalActionType = 'RETRY_WHATSAPP_MESSAGE' | 'SEND_PAYMENT_REMINDER' | 'RECALCULATE_RISK' | 'RUN_GOVERNANCE_CHECK'
export type OperationalActionStatus = 'REQUESTED' | 'EXECUTED' | 'FAILED' | 'CANCELED'

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
    await this.timeline.log({ orgId, action: 'OPERATIONAL_ACTION_REQUESTED', metadata: requestMetadata })
    return { actionType, entityType, entityId, status: 'REQUESTED' as OperationalActionStatus, requestedAt }
  }

  async execute(input: { orgId: string; actorUserId: string; actionType: OperationalActionType; sourceSignalId?: string | null; entityId: string }) {
    const { orgId, actorUserId, actionType, sourceSignalId, entityId } = input
    if (!orgId || !actorUserId) throw new BadRequestException('orgId/actor obrigatórios')
    const baseMeta = { actionType, sourceSignalId: sourceSignalId ?? null, entityId, actorUserId }
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
      await this.timeline.log({ orgId, action: 'OPERATIONAL_ACTION_EXECUTED', metadata: { ...baseMeta, nextStatus: 'EXECUTED', status: 'EXECUTED', ...result } })
      return { actionType, status: 'EXECUTED' as OperationalActionStatus, result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error'
      await this.timeline.log({ orgId, action: 'OPERATIONAL_ACTION_FAILED', metadata: { ...baseMeta, nextStatus: 'FAILED', errorMessage: message } })
      throw error
    }
  }
}
