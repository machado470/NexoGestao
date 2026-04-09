import { Injectable, Logger } from '@nestjs/common'
import { WhatsAppMessageType } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { FinanceService } from '../finance/finance.service'
import { ExecutionConfigService } from './execution.config'
import { ExecutionGovernanceService } from './execution.governance'
import { ExecutionEventsService } from './execution.events'
import { buildExecutionKey } from './execution.idempotency'
import type { ExecutionActionCandidate } from './execution.types'

@Injectable()
export class ExecutionRunner {
  private readonly logger = new Logger(ExecutionRunner.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceService,
    private readonly config: ExecutionConfigService,
    private readonly governance: ExecutionGovernanceService,
    private readonly events: ExecutionEventsService,
  ) {}

  async runOnce() {
    const orgs = await this.prisma.organization.findMany({
      select: { id: true },
      take: 200,
    })

    let totalCandidates = 0
    let executed = 0

    for (const org of orgs) {
      const candidates = await this.loadActionCandidates(org.id)
      totalCandidates += candidates.length

      for (const candidate of candidates) {
        const result = await this.processCandidate(candidate)
        if (result === 'executed') executed += 1
      }
    }

    this.logger.log(
      JSON.stringify({
        event: 'execution_runner_cycle',
        orgs: orgs.length,
        totalCandidates,
        executed,
      }),
    )

    return {
      orgs: orgs.length,
      totalCandidates,
      executed,
    }
  }

  private async loadActionCandidates(orgId: string): Promise<ExecutionActionCandidate[]> {
    const [
      chargeCandidates,
      linkCandidates,
      overdueReminderCandidates,
      operationalAlerts,
      financeTeamCandidates,
      operationalAttentionCandidates,
      chargeFollowupCandidates,
      riskEscalationCandidates,
    ] =
      await Promise.all([
      this.loadGenerateChargeCandidates(orgId),
      this.loadSendPaymentLinkCandidates(orgId),
      this.loadOverdueReminderCandidates(orgId),
      this.loadOperationalAlertCandidates(orgId),
      this.loadNotifyFinanceTeamCandidates(orgId),
      this.loadOperationalAttentionCandidates(orgId),
      this.loadCreateChargeFollowupCandidates(orgId),
      this.loadEscalateRiskReviewCandidates(orgId),
    ])

    return [
      ...chargeCandidates,
      ...linkCandidates,
      ...overdueReminderCandidates,
      ...operationalAlerts,
      ...financeTeamCandidates,
      ...operationalAttentionCandidates,
      ...chargeFollowupCandidates,
      ...riskEscalationCandidates,
    ]
  }

  private async loadGenerateChargeCandidates(orgId: string): Promise<ExecutionActionCandidate[]> {
    const doneWithoutCharge = await this.prisma.serviceOrder.findMany({
      where: {
        orgId,
        status: 'DONE',
        amountCents: { gt: 0 },
        charges: { none: {} },
      },
      select: {
        id: true,
        customerId: true,
        amountCents: true,
        dueDate: true,
      },
      take: 30,
      orderBy: { updatedAt: 'desc' },
    })

    return doneWithoutCharge.map((item) => ({
      actionId: 'action-generate-charge',
      decisionId: 'decision-done-without-charge',
      entityType: 'serviceOrder',
      entityId: item.id,
      orgId,
      metadata: {
        customerId: item.customerId,
        amountCents: item.amountCents,
        dueDate: item.dueDate ? item.dueDate.toISOString() : null,
      },
    }))
  }

  private async loadSendPaymentLinkCandidates(orgId: string): Promise<ExecutionActionCandidate[]> {
    const charges = await this.prisma.charge.findMany({
      where: {
        orgId,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      select: {
        id: true,
        customerId: true,
        customer: {
          select: {
            phone: true,
          },
        },
        amountCents: true,
        dueDate: true,
        status: true,
      },
      take: 30,
      orderBy: { updatedAt: 'desc' },
    })

    if (charges.length === 0) return []

    const chargeIds = charges.map((item) => item.id)
    const sent = await this.prisma.whatsAppMessage.findMany({
      where: {
        orgId,
        entityType: 'CHARGE',
        entityId: { in: chargeIds },
        messageType: WhatsAppMessageType.PAYMENT_LINK,
      },
      select: { entityId: true },
      distinct: ['entityId'],
    })

    const alreadySent = new Set(sent.map((item) => item.entityId))

    return charges
      .filter((item) => item.customer.phone.trim().length > 0)
      .filter((item) => !alreadySent.has(item.id))
      .map((item) => ({
        actionId: 'action-send-whatsapp-payment-link',
        decisionId: 'decision-pending-charge-without-payment-link',
        entityType: 'charge',
        entityId: item.id,
        orgId,
        metadata: {
          customerId: item.customerId,
          amountCents: item.amountCents,
          dueDate: item.dueDate ? item.dueDate.toISOString() : null,
          chargeStatus: item.status,
        },
      }))
  }

  private async loadOperationalAlertCandidates(orgId: string): Promise<ExecutionActionCandidate[]> {
    const [overdueCount, stalledServiceOrders] = await Promise.all([
      this.prisma.charge.count({ where: { orgId, status: 'OVERDUE' } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } } }),
    ])

    if (overdueCount < 3 && stalledServiceOrders < 8) {
      return []
    }

    return [
      {
        actionId: 'action-notify-operational-alert',
        decisionId: 'decision-operational-risk-threshold',
        entityType: 'system',
        entityId: `org:${orgId}`,
        orgId,
        metadata: {
          overdueCount,
          stalledServiceOrders,
          thresholdOverdue: 3,
          thresholdStalledServiceOrders: 8,
        },
      },
    ]
  }

  private async loadOverdueReminderCandidates(orgId: string): Promise<ExecutionActionCandidate[]> {
    const overdueCharges = await this.prisma.charge.findMany({
      where: {
        orgId,
        status: 'OVERDUE',
      },
      select: {
        id: true,
        customerId: true,
        customer: {
          select: {
            phone: true,
          },
        },
        amountCents: true,
        dueDate: true,
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    })

    return overdueCharges
      .filter((item) => item.customer.phone.trim().length > 0)
      .map((item) => ({
        actionId: 'action-send-overdue-charge-reminder',
        decisionId: 'decision-overdue-charge-reminder',
        entityType: 'charge',
        entityId: item.id,
        orgId,
        metadata: {
          customerId: item.customerId,
          amountCents: item.amountCents,
          dueDate: item.dueDate?.toISOString() ?? null,
          chargeStatus: 'OVERDUE',
        },
      }))
  }

  private async loadNotifyFinanceTeamCandidates(orgId: string): Promise<ExecutionActionCandidate[]> {
    const overdueCount = await this.prisma.charge.count({
      where: { orgId, status: 'OVERDUE' },
    })

    if (overdueCount < 5) return []

    return [
      {
        actionId: 'action-notify-finance-team',
        decisionId: 'decision-finance-overdue-threshold',
        entityType: 'system',
        entityId: `org:${orgId}`,
        orgId,
        metadata: {
          overdueCount,
          thresholdOverdue: 5,
        },
      },
    ]
  }

  private async loadOperationalAttentionCandidates(orgId: string): Promise<ExecutionActionCandidate[]> {
    const stalledServiceOrders = await this.prisma.serviceOrder.count({
      where: { orgId, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
    })

    if (stalledServiceOrders < 10) return []

    return [
      {
        actionId: 'action-mark-operational-attention',
        decisionId: 'decision-stalled-service-orders-attention-threshold',
        entityType: 'system',
        entityId: `org:${orgId}`,
        orgId,
        metadata: {
          stalledServiceOrders,
          thresholdStalledServiceOrders: 10,
        },
      },
    ]
  }
  private async loadCreateChargeFollowupCandidates(orgId: string): Promise<ExecutionActionCandidate[]> {
    const thresholdDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
    const charges = await this.prisma.charge.findMany({
      where: {
        orgId,
        status: 'OVERDUE',
        dueDate: { lte: thresholdDate },
      },
      select: {
        id: true,
        customerId: true,
        amountCents: true,
        dueDate: true,
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    })

    return charges.map((item) => ({
      actionId: 'action-create-charge-followup',
      decisionId: 'decision-overdue-charge-followup-threshold',
      entityType: 'charge',
      entityId: item.id,
      orgId,
      metadata: {
        customerId: item.customerId,
        amountCents: item.amountCents,
        dueDate: item.dueDate?.toISOString() ?? null,
        overdueDaysThreshold: 7,
      },
    }))
  }

  private async loadEscalateRiskReviewCandidates(orgId: string): Promise<ExecutionActionCandidate[]> {
    const [overdueCount, stalledServiceOrders] = await Promise.all([
      this.prisma.charge.count({ where: { orgId, status: 'OVERDUE' } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } } }),
    ])

    if (overdueCount < 8 || stalledServiceOrders < 12) return []

    return [
      {
        actionId: 'action-escalate-risk-review',
        decisionId: 'decision-escalate-risk-review-threshold',
        entityType: 'system',
        entityId: `org:${orgId}`,
        orgId,
        metadata: {
          overdueCount,
          stalledServiceOrders,
          thresholdOverdue: 8,
          thresholdStalledServiceOrders: 12,
        },
      },
    ]
  }

  private async processCandidate(candidate: ExecutionActionCandidate) {
    const mode = await this.config.getExecutionMode({ orgId: candidate.orgId })
    const policy = await this.config.getPolicyConfig({ orgId: candidate.orgId })

    const executionKey = buildExecutionKey({
      action: candidate,
      context: {
        orgId: candidate.orgId,
        mode,
        scope: 'runner_v5',
        payload: candidate.metadata ?? null,
      },
    })

    if (mode === 'manual') {
      await this.recordBlocked(candidate, executionKey, mode, 'mode_manual_runner_skip', 'blocked', {
        ruleId: candidate.decisionId,
        ruleReason: 'runner mode em manual',
        eligibility: 'blocked',
      })
      return 'blocked'
    }

    if (mode === 'semi_automatic') {
      await this.recordBlocked(
        candidate,
        executionKey,
        mode,
        'mode_semi_automatic_requires_confirmation',
        'requires_confirmation',
        {
          ruleId: candidate.decisionId,
          ruleReason: 'runner mode em semi_automatic',
          eligibility: 'requires_confirmation',
        },
      )
      return 'requires_confirmation'
    }

    if (candidate.actionId === 'action-generate-charge' && !policy.allowAutomaticCharge) {
      await this.recordBlocked(candidate, executionKey, mode, 'policy_automatic_charge_disabled', 'blocked', {
        ruleId: candidate.decisionId,
        policyKey: 'allowAutomaticCharge',
        policyValue: policy.allowAutomaticCharge,
      })
      return 'blocked'
    }

    if (candidate.actionId === 'action-send-whatsapp-payment-link' && !policy.allowWhatsAppAuto) {
      await this.recordBlocked(candidate, executionKey, mode, 'policy_whatsapp_automatic_disabled', 'blocked', {
        ruleId: candidate.decisionId,
        policyKey: 'allowWhatsAppAuto',
        policyValue: policy.allowWhatsAppAuto,
      })
      return 'blocked'
    }
    if (candidate.actionId === 'action-send-overdue-charge-reminder' && !policy.allowOverdueReminderAuto) {
      await this.recordBlocked(candidate, executionKey, mode, 'policy_overdue_reminder_disabled', 'blocked', {
        ruleId: candidate.decisionId,
        policyKey: 'allowOverdueReminderAuto',
        policyValue: policy.allowOverdueReminderAuto,
      })
      return 'blocked'
    }
    if (candidate.actionId === 'action-notify-finance-team' && !policy.allowFinanceTeamNotifications) {
      await this.recordBlocked(candidate, executionKey, mode, 'policy_finance_team_notification_disabled', 'blocked', {
        ruleId: candidate.decisionId,
        policyKey: 'allowFinanceTeamNotifications',
        policyValue: policy.allowFinanceTeamNotifications,
      })
      return 'blocked'
    }
    if (candidate.actionId === 'action-mark-operational-attention' && !policy.allowGovernanceFollowup) {
      await this.recordBlocked(candidate, executionKey, mode, 'policy_operational_attention_disabled', 'blocked', {
        ruleId: candidate.decisionId,
        policyKey: 'allowGovernanceFollowup',
        policyValue: policy.allowGovernanceFollowup,
      })
      return 'blocked'
    }
    if (candidate.actionId === 'action-create-charge-followup' && !policy.allowChargeFollowupCreation) {
      await this.recordBlocked(candidate, executionKey, mode, 'policy_charge_followup_creation_disabled', 'blocked', {
        ruleId: candidate.decisionId,
        policyKey: 'allowChargeFollowupCreation',
        policyValue: policy.allowChargeFollowupCreation,
      })
      return 'blocked'
    }
    if (candidate.actionId === 'action-escalate-risk-review' && !policy.allowRiskReviewEscalation) {
      await this.recordBlocked(candidate, executionKey, mode, 'policy_risk_review_escalation_disabled', 'blocked', {
        ruleId: candidate.decisionId,
        policyKey: 'allowRiskReviewEscalation',
        policyValue: policy.allowRiskReviewEscalation,
      })
      return 'blocked'
    }

    const governance = this.governance.evaluate(candidate)
    if (governance.status !== 'allowed') {
      await this.recordBlocked(
        candidate,
        executionKey,
        mode,
        governance.reasonCode ?? 'governance_blocked',
        governance.status === 'blocked' ? 'blocked' : 'requires_confirmation',
        {
          ruleId: candidate.decisionId,
          governanceReason: governance.reasonCode ?? 'governance_blocked',
        },
      )
      return governance.status
    }

    const alreadyExecuted = await this.events.hasRecentExecution({
      orgId: candidate.orgId,
      executionKey,
      withinMs: policy.throttleWindowMs,
    })

    if (alreadyExecuted) {
      await this.recordBlocked(candidate, executionKey, mode, 'idempotency_recent_execution', 'blocked', {
        ruleId: candidate.decisionId,
        ruleReason: 'idempotency',
      })
      return 'blocked'
    }

    const failureCount = await this.events.countRecentFailures({
      orgId: candidate.orgId,
      executionKey,
      withinMs: policy.throttleWindowMs,
    })

    if (failureCount >= policy.maxRetries) {
      await this.recordBlocked(candidate, executionKey, mode, 'retry_limit_reached', 'throttled', {
        ruleId: candidate.decisionId,
        ruleReason: 'retry limit reached',
      })
      return 'throttled'
    }

    await this.events.recordEvent(candidate.orgId, {
      eventType: 'EXECUTION_ACTION_REQUESTED',
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      actionId: candidate.actionId,
      decisionId: candidate.decisionId,
      executionKey,
      mode,
      status: 'pending',
      reasonCode: 'runner_execution_requested',
      timestamp: new Date().toISOString(),
      metadata: {
        policySnapshot: policy,
        trigger: candidate.metadata ?? {},
      },
      explanation: {
        ruleId: candidate.decisionId,
        eligibility: 'eligible',
        trigger: candidate.metadata ?? {},
      },
    })

    try {
      await this.executeCandidate(candidate)

      await this.events.recordEvent(candidate.orgId, {
        eventType: 'EXECUTION_ACTION_EXECUTED',
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        actionId: candidate.actionId,
        decisionId: candidate.decisionId,
        executionKey,
        mode,
        status: 'executed',
        reasonCode: 'runner_executed',
        timestamp: new Date().toISOString(),
        explanation: {
          ruleId: candidate.decisionId,
          eligibility: 'executed',
          trigger: candidate.metadata ?? {},
        },
      })

      this.logger.log(
        JSON.stringify({
          event: 'execution_runner_executed',
          orgId: candidate.orgId,
          actionId: candidate.actionId,
          entityType: candidate.entityType,
          entityId: candidate.entityId,
          decisionId: candidate.decisionId,
          executionKey,
        }),
      )

      return 'executed'
    } catch (error) {
      await this.events.recordEvent(candidate.orgId, {
        eventType: 'EXECUTION_ACTION_FAILED',
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        actionId: candidate.actionId,
        decisionId: candidate.decisionId,
        executionKey,
        mode,
        status: 'failed',
        reasonCode: 'runner_execution_failed',
        timestamp: new Date().toISOString(),
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          trigger: candidate.metadata ?? {},
        },
        explanation: {
          ruleId: candidate.decisionId,
          eligibility: 'failed',
          trigger: candidate.metadata ?? {},
        },
      })

      this.logger.error(
        JSON.stringify({
          event: 'execution_runner_failed',
          orgId: candidate.orgId,
          actionId: candidate.actionId,
          entityType: candidate.entityType,
          entityId: candidate.entityId,
          decisionId: candidate.decisionId,
          executionKey,
          error: error instanceof Error ? error.message : String(error),
        }),
      )

      return 'failed'
    }
  }

  private async recordBlocked(
    candidate: ExecutionActionCandidate,
    executionKey: string,
    mode: 'manual' | 'semi_automatic' | 'automatic',
    reasonCode: string,
    status: 'blocked' | 'requires_confirmation' | 'throttled',
    explanation?: {
      ruleId?: string
      ruleReason?: string
      eligibility?: string
      policyKey?: string
      policyValue?: unknown
      governanceReason?: string
    },
  ) {
    await this.events.recordEvent(candidate.orgId, {
      eventType: 'EXECUTION_ACTION_BLOCKED',
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      actionId: candidate.actionId,
      decisionId: candidate.decisionId,
      executionKey,
      mode,
      status,
      reasonCode,
      timestamp: new Date().toISOString(),
      explanation,
    })

    this.logger.warn(
      JSON.stringify({
        event: 'execution_runner_blocked',
        orgId: candidate.orgId,
        actionId: candidate.actionId,
        decisionId: candidate.decisionId,
        reasonCode,
        status,
        executionKey,
      }),
    )
  }

  private async executeCandidate(candidate: ExecutionActionCandidate) {
    if (candidate.actionId === 'action-generate-charge') {
      const amountCents = Number(candidate.metadata?.amountCents ?? 0)
      const customerId = String(candidate.metadata?.customerId ?? '')
      const dueDateRaw = candidate.metadata?.dueDate
      const dueDate = typeof dueDateRaw === 'string' && dueDateRaw ? new Date(dueDateRaw) : null

      await this.finance.ensureChargeForServiceOrderDone({
        orgId: candidate.orgId,
        serviceOrderId: candidate.entityId,
        customerId,
        amountCents,
        dueDate,
        actorUserId: null,
      })
      return
    }

    if (candidate.actionId === 'action-send-whatsapp-payment-link') {
      const charge = await this.prisma.charge.findFirst({
        where: {
          id: candidate.entityId,
          orgId: candidate.orgId,
          status: { in: ['PENDING', 'OVERDUE'] },
          customer: { phone: { not: null } },
        },
        select: { id: true },
      })

      if (!charge) {
        throw new Error('charge_not_eligible_for_payment_link')
      }

      await this.finance.sendChargeWhatsApp(charge.id)
      return
    }

    if (candidate.actionId === 'action-notify-operational-alert') {
      await this.prisma.timelineEvent.create({
        data: {
          orgId: candidate.orgId,
          action: 'OPERATIONAL_ALERT',
          description: 'Alerta operacional automático da execution v5',
          metadata: {
            source: 'execution_runner_v5',
            decisionId: candidate.decisionId,
            ...candidate.metadata,
          },
        },
      })
      return
    }

    if (candidate.actionId === 'action-send-overdue-charge-reminder') {
      const charge = await this.prisma.charge.findFirst({
        where: {
          id: candidate.entityId,
          orgId: candidate.orgId,
          status: 'OVERDUE',
          customer: { phone: { not: null } },
        },
        select: { id: true },
      })

      if (!charge) {
        throw new Error('charge_not_eligible_for_overdue_reminder')
      }

      await this.finance.sendPaymentReminderWhatsApp(charge.id)
      return
    }

    if (candidate.actionId === 'action-notify-finance-team') {
      await this.prisma.timelineEvent.create({
        data: {
          orgId: candidate.orgId,
          action: 'FINANCE_TEAM_NOTIFICATION',
          description: 'Notificação para equipe financeira criada automaticamente',
          metadata: {
            source: 'execution_runner_v5',
            decisionId: candidate.decisionId,
            ...candidate.metadata,
          },
        },
      })
      return
    }

    if (candidate.actionId === 'action-mark-operational-attention') {
      await this.prisma.timelineEvent.create({
        data: {
          orgId: candidate.orgId,
          action: 'OPERATIONAL_ATTENTION_MARKED',
          description: 'Sinal operacional de atenção marcado automaticamente',
          metadata: {
            source: 'execution_runner_v5',
            decisionId: candidate.decisionId,
            ...candidate.metadata,
          },
        },
      })
      return
    }
    if (candidate.actionId === 'action-create-charge-followup') {
      const charge = await this.prisma.charge.findFirst({
        where: {
          id: candidate.entityId,
          orgId: candidate.orgId,
          status: 'OVERDUE',
        },
        select: {
          id: true,
          dueDate: true,
        },
      })
      if (!charge?.dueDate) throw new Error('charge_not_eligible_for_followup')

      const overdueDays = Math.floor((Date.now() - charge.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      if (overdueDays < 7) throw new Error('charge_not_overdue_enough_for_followup')

      const existing = await this.prisma.timelineEvent.findFirst({
        where: {
          orgId: candidate.orgId,
          action: 'CHARGE_FOLLOWUP_CREATED',
          chargeId: charge.id,
          createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) },
        },
        select: { id: true },
      })
      if (existing?.id) throw new Error('charge_followup_already_exists')

      await this.prisma.timelineEvent.create({
        data: {
          orgId: candidate.orgId,
          action: 'CHARGE_FOLLOWUP_CREATED',
          chargeId: charge.id,
          description: 'Follow-up de cobrança criado automaticamente',
          metadata: {
            source: 'execution_runner_v5',
            decisionId: candidate.decisionId,
            ...candidate.metadata,
          },
        },
      })
      return
    }

    if (candidate.actionId === 'action-escalate-risk-review') {
      const existing = await this.prisma.timelineEvent.findFirst({
        where: {
          orgId: candidate.orgId,
          action: 'RISK_REVIEW_ESCALATED',
          createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) },
        },
        select: { id: true },
      })
      if (existing?.id) throw new Error('risk_review_already_escalated_recently')

      await this.prisma.timelineEvent.create({
        data: {
          orgId: candidate.orgId,
          action: 'RISK_REVIEW_ESCALATED',
          description: 'Escalada automática para revisão de risco operacional/financeiro',
          metadata: {
            source: 'execution_runner_v5',
            decisionId: candidate.decisionId,
            ...candidate.metadata,
          },
        },
      })
      return
    }

    throw new Error(`unsupported_action:${candidate.actionId}`)
  }
}
