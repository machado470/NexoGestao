import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  AutomationActionType,
  AutomationExecutionStatus,
  AutomationTrigger,
  NotificationType,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { RiskService } from '../risk/risk.service'
import { WhatsAppService } from '../whatsapp/whatsapp.service'
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto'
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto'

type AutomationContext = {
  orgId: string
  trigger: AutomationTrigger
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
  ) {}

  async listRules(orgId: string) {
    return this.prisma.automationRule.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createRule(orgId: string, actorUserId: string | null, dto: CreateAutomationRuleDto) {
    if (!Array.isArray(dto.actionSet) || dto.actionSet.length === 0) {
      throw new BadRequestException('actionSet deve conter ao menos uma ação')
    }

    return this.prisma.automationRule.create({
      data: {
        orgId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        trigger: dto.trigger,
        conditionSet: dto.conditionSet ?? undefined,
        actionSet: dto.actionSet,
        active: dto.active ?? true,
        createdByUserId: actorUserId,
      },
    })
  }

  async updateRule(orgId: string, id: string, dto: UpdateAutomationRuleDto) {
    const existing = await this.prisma.automationRule.findFirst({ where: { id, orgId } })
    if (!existing) throw new NotFoundException('Regra de automação não encontrada')

    return this.prisma.automationRule.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        trigger: dto.trigger,
        conditionSet: dto.conditionSet,
        actionSet: dto.actionSet,
        active: dto.active,
      },
    })
  }

  async executeTrigger(context: AutomationContext) {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        orgId: context.orgId,
        trigger: context.trigger,
        active: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const results: Array<{ ruleId: string; status: AutomationExecutionStatus; actions: number; error?: string }> = []

    for (const rule of rules) {
      const execution = await this.prisma.automationExecution.create({
        data: {
          orgId: context.orgId,
          ruleId: rule.id,
          trigger: context.trigger,
          eventPayload: context.payload,
          status: 'PENDING',
        },
      })

      const shouldRun = this.evaluateCondition(rule.conditionSet as Record<string, any> | null, context.payload)
      if (!shouldRun) {
        await this.prisma.automationExecution.update({
          where: { id: execution.id },
          data: {
            status: 'SKIPPED',
            resultPayload: { reason: 'condition_not_matched' },
            finishedAt: new Date(),
          },
        })

        results.push({ ruleId: rule.id, status: 'SKIPPED', actions: 0 })
        continue
      }

      try {
        const actionSet = Array.isArray(rule.actionSet) ? rule.actionSet as any[] : []
        let executedActions = 0

        for (const action of actionSet) {
          const handled = await this.executeAction({
            orgId: context.orgId,
            action,
            payload: context.payload,
          })
          if (handled) executedActions++
        }

        await this.prisma.automationExecution.update({
          where: { id: execution.id },
          data: {
            status: 'SUCCESS',
            resultPayload: { executedActions },
            finishedAt: new Date(),
          },
        })

        await this.prisma.automationRule.update({
          where: { id: rule.id },
          data: { lastRunAt: new Date() },
        })

        results.push({ ruleId: rule.id, status: 'SUCCESS', actions: executedActions })
      } catch (error: any) {
        const message = error?.message ?? String(error)
        this.logger.error(`automation execution failed rule=${rule.id}: ${message}`)

        await this.prisma.automationExecution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            errorMessage: message,
            finishedAt: new Date(),
          },
        })

        results.push({ ruleId: rule.id, status: 'FAILED', actions: 0, error: message })
      }
    }

    return {
      trigger: context.trigger,
      matchedRules: rules.length,
      results,
    }
  }

  private evaluateCondition(conditionSet: Record<string, any> | null, payload: Record<string, any>) {
    if (!conditionSet || Object.keys(conditionSet).length === 0) return true

    const all = Array.isArray(conditionSet.all) ? conditionSet.all : []
    const any = Array.isArray(conditionSet.any) ? conditionSet.any : []

    const allOk = all.length === 0 || all.every((it) => this.matchPredicate(it, payload))
    const anyOk = any.length === 0 || any.some((it) => this.matchPredicate(it, payload))

    return allOk && anyOk
  }

  private matchPredicate(predicate: any, payload: Record<string, any>) {
    const path = String(predicate?.field ?? '').trim()
    const op = String(predicate?.operator ?? 'equals').trim()
    const expected = predicate?.value
    const actual = this.getByPath(payload, path)

    switch (op) {
      case 'equals':
        return actual === expected
      case 'notEquals':
        return actual !== expected
      case 'gt':
        return Number(actual) > Number(expected)
      case 'gte':
        return Number(actual) >= Number(expected)
      case 'lt':
        return Number(actual) < Number(expected)
      case 'lte':
        return Number(actual) <= Number(expected)
      case 'in':
        return Array.isArray(expected) && expected.includes(actual)
      case 'exists':
        return actual !== undefined && actual !== null
      default:
        return false
    }
  }

  private getByPath(payload: Record<string, any>, path: string): any {
    if (!path) return undefined
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), payload)
  }

  private async executeAction(input: {
    orgId: string
    action: Record<string, any>
    payload: Record<string, any>
  }) {
    const actionType = String(input.action?.type ?? '').trim() as AutomationActionType

    if (actionType === AutomationActionType.CREATE_NOTIFICATION) {
      const message = input.action.message ?? 'Automação executada com sucesso'
      const type = (input.action.notificationType ?? 'PAYMENT_OVERDUE') as NotificationType
      await this.notifications.createNotification(input.orgId, type, message, undefined, {
        automationAction: input.action,
        payload: input.payload,
      })
      return true
    }

    if (actionType === AutomationActionType.SEND_WHATSAPP_MESSAGE) {
      const customerId = input.payload.customerId
      const toPhone = input.payload.customerPhone
      if (!customerId || !toPhone) return false

      await this.whatsapp.queueMessage({
        orgId: input.orgId,
        customerId,
        toPhone,
        entityType: input.action.entityType ?? 'CHARGE',
        entityId: input.payload.entityId ?? customerId,
        messageType: input.action.messageType ?? 'PAYMENT_REMINDER',
        messageKey: `automation:${input.action.id ?? actionType}:${input.payload.entityId ?? customerId}:${Date.now()}`,
        renderedText: input.action.renderedText ?? 'Mensagem automática enviada.',
        metadata: { automationAction: input.action },
      })
      return true
    }

    if (actionType === AutomationActionType.CREATE_CHARGE) {
      const customerId = input.payload.customerId
      if (!customerId) return false

      const amountCents = Number(input.action.amountCents ?? 0)
      if (!Number.isFinite(amountCents) || amountCents <= 0) return false

      const dueInDays = Number(input.action.dueInDays ?? 3)
      const dueDate = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000)

      await this.prisma.charge.create({
        data: {
          orgId: input.orgId,
          customerId,
          serviceOrderId: input.payload.serviceOrderId ?? null,
          amountCents,
          dueDate,
          title: input.action.title ?? 'Cobrança gerada por automação',
          description: input.action.description ?? null,
          status: 'PENDING',
        },
      })
      return true
    }

    if (actionType === AutomationActionType.UPDATE_RISK) {
      const customerId = input.payload.customerId
      if (!customerId) return false

      await this.risk.recalculateCustomerOperationalRisk(
        input.orgId,
        customerId,
        input.action.reason ?? 'AUTOMATION_RULE',
      )
      return true
    }

    return false
  }
}
