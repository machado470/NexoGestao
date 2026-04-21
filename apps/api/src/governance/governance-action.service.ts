import { BadRequestException, Injectable } from '@nestjs/common'
import { FinanceService } from '../finance/finance.service'
import { ServiceOrdersService } from '../service-orders/service-orders.service'
import { TimelineService } from '../timeline/timeline.service'

type GovernanceActionType = 'charge' | 'message' | 'assignment' | 'schedule'

type GovernanceActionInput = {
  id: string
  type: GovernanceActionType
  label: string
  description: string
  requiresConfirmation?: boolean
  context: Record<string, unknown>
}

type GovernanceActionActor = {
  userId: string | null
  personId: string | null
  orgId: string
}

@Injectable()
export class GovernanceActionService {
  constructor(
    private readonly finance: FinanceService,
    private readonly serviceOrders: ServiceOrdersService,
    private readonly timeline: TimelineService,
  ) {}

  async execute(actor: GovernanceActionActor, input: GovernanceActionInput) {
    if (!input?.id || !input?.type || !input?.label) {
      throw new BadRequestException('Ação inválida: id, type e label são obrigatórios')
    }

    if (!input.context || typeof input.context !== 'object') {
      throw new BadRequestException('Ação inválida: contexto completo é obrigatório')
    }

    const context = input.context

    let result: Record<string, unknown>

    try {
      switch (input.id) {
        case 'charge.send_whatsapp': {
          const chargeId = String(context.chargeId ?? '').trim()
          if (!chargeId) {
            throw new BadRequestException('context.chargeId é obrigatório para enviar cobrança')
          }
          await this.finance.remindChargeInOrg(actor.orgId, chargeId)
          result = { chargeId, delivery: 'payment_reminder_whatsapp' }
          break
        }

        case 'assignment.assign_owner': {
          const serviceOrderId = String(context.serviceOrderId ?? '').trim()
          const assignedToPersonId = String(context.assignedToPersonId ?? '').trim()
          const expectedUpdatedAt = String(context.expectedUpdatedAt ?? '').trim()

          if (!serviceOrderId || !assignedToPersonId || !expectedUpdatedAt) {
            throw new BadRequestException(
              'context.serviceOrderId, context.assignedToPersonId e context.expectedUpdatedAt são obrigatórios para atribuição',
            )
          }

          const updated = await this.serviceOrders.update({
            orgId: actor.orgId,
            updatedBy: actor.userId,
            personId: actor.personId,
            id: serviceOrderId,
            data: {
              assignedToPersonId,
              expectedUpdatedAt,
            },
          })

          result = {
            serviceOrderId,
            assignedToPersonId,
            status: updated.status,
          }
          break
        }

        default:
          throw new BadRequestException(`Ação não suportada nesta versão: ${input.id}`)
      }

      await this.timeline.log({
        orgId: actor.orgId,
        personId: actor.personId,
        action: 'GOVERNANCE_ACTION_EXECUTED',
        description: input.description,
        metadata: {
          actionId: input.id,
          actionType: input.type,
          label: input.label,
          requiresConfirmation: Boolean(input.requiresConfirmation),
          context,
          result,
          actorUserId: actor.userId,
          actorPersonId: actor.personId,
          status: 'success',
          source: 'governance_action_engine',
        },
      })

      return {
        ok: true,
        id: input.id,
        type: input.type,
        message: 'Ação executada com sucesso',
        result,
      }
    } catch (error) {
      await this.timeline.log({
        orgId: actor.orgId,
        personId: actor.personId,
        action: 'GOVERNANCE_ACTION_EXECUTED',
        description: input.description,
        metadata: {
          actionId: input.id,
          actionType: input.type,
          label: input.label,
          requiresConfirmation: Boolean(input.requiresConfirmation),
          context,
          actorUserId: actor.userId,
          actorPersonId: actor.personId,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          source: 'governance_action_engine',
        },
      })
      throw error
    }
  }
}
