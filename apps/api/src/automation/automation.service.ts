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
  ) {}

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
