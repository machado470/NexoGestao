import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
// import {
//   AutomationActionType,
//   AutomationTrigger,
// } from '@prisma/client'

export type AutomationTrigger = string
export const AutomationActionType = {
  SEND_WHATSAPP_MESSAGE: 'SEND_WHATSAPP_MESSAGE',
  CREATE_CHARGE: 'CREATE_CHARGE',
  CREATE_NOTIFICATION: 'CREATE_NOTIFICATION',
  UPDATE_RISK: 'UPDATE_RISK',
} as const
export type AutomationActionType = keyof typeof AutomationActionType

import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { RiskService } from '../risk/risk.service'
import { WhatsAppService } from '../whatsapp/whatsapp.service'
import { QueueService } from '../queue/queue.service'
import { QUEUE_NAMES } from '../queue/queue.constants'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'
import {
  CommercialPolicyService,
  isCommercialBlocked,
} from '../common/commercial/commercial-policy.service'

import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto'
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto'

type AutomationContext = {
  orgId: string
  trigger: string
  payload: Record<string, any>
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly risk: RiskService,
    private readonly whatsapp: WhatsAppService,
    private readonly queueService: QueueService,
    private readonly tenantOps: TenantOperationsService,
    private readonly commercial: CommercialPolicyService,
  ) {}

  private matchesConditions(
    conditionSet: Array<Record<string, any>> | null | undefined,
    payload: Record<string, any>,
  ): boolean {
    if (!Array.isArray(conditionSet) || conditionSet.length === 0) return true

    return conditionSet.every((condition) => {
      const field = String(condition?.field ?? '').trim()
      const op = String(condition?.operator ?? 'eq').trim()
      const expected = condition?.value
      const actual = field ? payload[field] : undefined

      if (!field) return false
      if (op === 'eq') return actual === expected
      if (op === 'neq') return actual !== expected
      if (op === 'in') return Array.isArray(expected) && expected.includes(actual)
      if (op === 'gte') return Number(actual) >= Number(expected)
      if (op === 'lte') return Number(actual) <= Number(expected)
      return false
    })
  }

  private get automationRuleDelegate(): any | null {
    const prismaAny = this.prisma as any
    return prismaAny.automationRule ?? null
  }

  private get automationExecutionDelegate(): any | null {
    const prismaAny = this.prisma as any
    return prismaAny.automationExecution ?? null
  }

  async listRules(orgId: string) {
    const delegate = this.automationRuleDelegate
    if (!delegate) return []

    return delegate.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createRule(orgId: string, actorUserId: string | null, dto: CreateAutomationRuleDto) {
    if (!Array.isArray(dto.actionSet) || dto.actionSet.length === 0) {
      throw new BadRequestException('actionSet deve conter ao menos uma ação')
    }

    const delegate = this.automationRuleDelegate
    if (!delegate) {
      return {
        disabled: true,
        reason: 'AutomationRule model não está disponível no Prisma atual.',
      }
    }

    return delegate.create({
      data: {
        orgId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        trigger: dto.trigger as AutomationTrigger,
        conditionSet: dto.conditionSet ?? undefined,
        actionSet: dto.actionSet,
        active: dto.active ?? true,
        createdByUserId: actorUserId,
      },
    })
  }

  async updateRule(orgId: string, id: string, dto: UpdateAutomationRuleDto) {
    const delegate = this.automationRuleDelegate
    if (!delegate) {
      throw new NotFoundException('Regra de automação não disponível neste ambiente')
    }

    const existing = await delegate.findFirst({
      where: { id, orgId },
    })

    if (!existing) {
      throw new NotFoundException('Regra de automação não encontrada')
    }

    return delegate.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        trigger: dto.trigger ? (dto.trigger as AutomationTrigger) : undefined,
        conditionSet: dto.conditionSet,
        actionSet: dto.actionSet,
        active: dto.active,
      },
    })
  }

  async executeTrigger(context: AutomationContext) {
    const ruleDelegate = this.automationRuleDelegate
    const executionDelegate = this.automationExecutionDelegate

    if (!ruleDelegate || !executionDelegate) {
      return {
        trigger: context.trigger,
        matchedRules: 0,
        results: [],
        disabled: true,
      }
    }

    const triggerEnum = context.trigger as AutomationTrigger

    const rules = await ruleDelegate.findMany({
      where: {
        orgId: context.orgId,
        trigger: triggerEnum,
        active: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const results: any[] = []

    for (const rule of rules) {
      if (!this.matchesConditions(rule.conditionSet as Array<Record<string, any>> | undefined, context.payload)) {
        this.tenantOps.increment(context.orgId, 'automation_blocked')
        continue
      }

      const featureAccess = await this.commercial.canUseFeature(context.orgId, 'advanced_automation')
      if (isCommercialBlocked(featureAccess)) {
        this.tenantOps.increment(context.orgId, 'automation_blocked')
        this.tenantOps.recordCriticalEvent(context.orgId, 'automation_plan_blocked', {
          ruleId: rule.id,
          reason: featureAccess.reasonCode,
        })
        results.push({
          ruleId: rule.id,
          status: 'BLOCKED',
          actions: 0,
          reason: featureAccess.reasonCode,
          policyType: featureAccess.policyType,
          message: featureAccess.reasonMessage,
        })
        continue
      }

      const planLimit = await this.commercial.enforceMeter(context.orgId, 'automation_executions')
      if (isCommercialBlocked(planLimit)) {
        this.tenantOps.increment(context.orgId, 'automation_blocked')
        results.push({
          ruleId: rule.id,
          status: 'BLOCKED',
          actions: 0,
          reason: planLimit.reasonCode,
          policyType: planLimit.policyType,
          message: planLimit.reasonMessage,
        })
        continue
      }

      const limit = this.tenantOps.enforceLimit({
        orgId: context.orgId,
        scope: 'automation:execute-trigger',
        limit: 100,
        windowMs: 60_000,
        blockedReason: 'tenant_automation_rate_limit_reached',
      })

      if (!limit.allowed) {
        this.tenantOps.increment(context.orgId, 'automation_throttled')
        this.tenantOps.recordCriticalEvent(context.orgId, 'automation_throttled', {
          ruleId: rule.id,
          trigger: context.trigger,
          used: limit.used,
          limit: limit.limit,
        })
        results.push({
          ruleId: rule.id,
          status: 'THROTTLED',
          actions: 0,
          reason: limit.reason,
        })
        continue
      }

      const execution = await executionDelegate.create({
        data: {
          orgId: context.orgId,
          ruleId: rule.id,
          trigger: triggerEnum,
          eventPayload: context.payload,
          status: 'PENDING',
        },
      })

      try {
        const actionSet = Array.isArray(rule.actionSet) ? (rule.actionSet as any[]) : []
        let executedActions = 0

        for (const action of actionSet) {
          const handled = await this.enqueueAutomationAction({
            orgId: context.orgId,
            action,
            payload: context.payload,
          })

          if (handled) executedActions++
        }

        await executionDelegate.update({
          where: { id: execution.id },
          data: {
            status: 'SUCCESS',
            resultPayload: { executedActions },
            finishedAt: new Date(),
          },
        })

        results.push({
          ruleId: rule.id,
          status: 'SUCCESS',
          actions: executedActions,
        })
        this.tenantOps.increment(context.orgId, 'automation_execution')
      } catch (error: any) {
        const message = error?.message ?? String(error)

        this.logger.error(`automation execution failed rule=${rule.id}: ${message}`)

        await executionDelegate.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            errorMessage: message,
            finishedAt: new Date(),
          },
        })

        results.push({
          ruleId: rule.id,
          status: 'FAILED',
          actions: 0,
          error: message,
        })
      }
    }

    return {
      trigger: context.trigger,
      matchedRules: rules.length,
      results,
    }
  }

  async executeActionJob(input: {
    orgId: string
    action: Record<string, any>
    payload: Record<string, any>
  }) {
    await this.executeAction(input)
  }

  private async executeAction(input: {
    orgId: string
    action: Record<string, any>
    payload: Record<string, any>
  }) {
    const actionType = String(input.action?.type ?? '').trim() as AutomationActionType

    if (!Object.values(AutomationActionType).includes(actionType)) {
      this.logger.warn(`Unknown automation action type: ${actionType}`)
      return false
    }

    await this.queueService.addJob(QUEUE_NAMES.AUTOMATION, 'execute-action', input)
    return true
  }

  private async enqueueAutomationAction(input: {
    orgId: string
    action: Record<string, any>
    payload: Record<string, any>
  }) {
    const actionType = String(input.action?.type ?? '').trim() as AutomationActionType

    if (!Object.values(AutomationActionType).includes(actionType)) {
      return false
    }

    await this.queueService.addJob(QUEUE_NAMES.AUTOMATION, 'execute-action', input)

    return true
  }
}
