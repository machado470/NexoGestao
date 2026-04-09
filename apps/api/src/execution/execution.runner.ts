import { Injectable, Logger } from '@nestjs/common'
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

    this.logger.log(`execution_runner cycle orgs=${orgs.length} candidates=${totalCandidates} executed=${executed}`)

    return {
      orgs: orgs.length,
      totalCandidates,
      executed,
    }
  }

  private async loadActionCandidates(orgId: string): Promise<ExecutionActionCandidate[]> {
    const doneWithoutCharge = await this.prisma.serviceOrder.findMany({
      where: {
        orgId,
        status: 'DONE',
        amountCents: { gt: 0 },
        charges: { none: {} },
      },
      select: {
        id: true,
        orgId: true,
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

  private async processCandidate(candidate: ExecutionActionCandidate) {
    const mode = this.config.getExecutionMode({ orgId: candidate.orgId })
    const policy = this.config.getPolicyConfig({ orgId: candidate.orgId })

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
      await this.events.recordEvent(candidate.orgId, {
        eventType: 'EXECUTION_ACTION_BLOCKED',
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        actionId: candidate.actionId,
        decisionId: candidate.decisionId,
        executionKey,
        mode,
        status: 'blocked',
        reasonCode: 'mode_manual_runner_skip',
        timestamp: new Date().toISOString(),
      })
      return 'blocked'
    }

    if (mode === 'semi_automatic') {
      await this.events.recordEvent(candidate.orgId, {
        eventType: 'EXECUTION_ACTION_BLOCKED',
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        actionId: candidate.actionId,
        decisionId: candidate.decisionId,
        executionKey,
        mode,
        status: 'requires_confirmation',
        reasonCode: 'mode_semi_automatic_requires_confirmation',
        timestamp: new Date().toISOString(),
      })
      return 'requires_confirmation'
    }

    if (candidate.actionId === 'action-generate-charge' && !policy.allowAutomaticCharge) {
      await this.events.recordEvent(candidate.orgId, {
        eventType: 'EXECUTION_ACTION_BLOCKED',
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        actionId: candidate.actionId,
        decisionId: candidate.decisionId,
        executionKey,
        mode,
        status: 'blocked',
        reasonCode: 'policy_automatic_charge_disabled',
        timestamp: new Date().toISOString(),
      })
      return 'blocked'
    }

    const governance = this.governance.evaluate(candidate)
    if (governance.status !== 'allowed') {
      await this.events.recordEvent(candidate.orgId, {
        eventType: 'EXECUTION_ACTION_BLOCKED',
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        actionId: candidate.actionId,
        decisionId: candidate.decisionId,
        executionKey,
        mode,
        status: governance.status === 'blocked' ? 'blocked' : 'requires_confirmation',
        reasonCode: governance.reasonCode,
        timestamp: new Date().toISOString(),
      })
      return governance.status
    }

    const alreadyExecuted = await this.events.hasRecentExecution({
      orgId: candidate.orgId,
      executionKey,
      withinMs: policy.throttleWindowMs,
    })

    if (alreadyExecuted) {
      await this.events.recordEvent(candidate.orgId, {
        eventType: 'EXECUTION_ACTION_BLOCKED',
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        actionId: candidate.actionId,
        decisionId: candidate.decisionId,
        executionKey,
        mode,
        status: 'blocked',
        reasonCode: 'idempotency_recent_execution',
        timestamp: new Date().toISOString(),
      })
      return 'blocked'
    }

    const failureCount = await this.events.countRecentFailures({
      orgId: candidate.orgId,
      executionKey,
      withinMs: policy.throttleWindowMs,
    })

    if (failureCount >= policy.maxRetries) {
      await this.events.recordEvent(candidate.orgId, {
        eventType: 'EXECUTION_ACTION_BLOCKED',
        entityType: candidate.entityType,
        entityId: candidate.entityId,
        actionId: candidate.actionId,
        decisionId: candidate.decisionId,
        executionKey,
        mode,
        status: 'throttled',
        reasonCode: 'retry_limit_reached',
        timestamp: new Date().toISOString(),
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
      status: 'executed',
      reasonCode: 'runner_execution_requested',
      timestamp: new Date().toISOString(),
    })

    try {
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
      }

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
      })

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
        },
      })

      return 'failed'
    }
  }
}
