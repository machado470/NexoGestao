import { ForbiddenException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { OperationalStateService } from '../people/operational-state.service'
import { RiskService } from '../risk/risk.service'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { RequestContextService } from '../common/context/request-context.service'

/** Who closes a corrective action, derived only from the authenticated session. */
export type CorrectiveActionActor = { userId: string | null; personId: string | null }

/** Without a verifiable session user and person the self-resolution rule cannot be enforced: deny. */
function assertVerifiableActor(actor: CorrectiveActionActor | undefined): asserts actor is { userId: string; personId: string } {
  if (!actor?.userId || !actor?.personId) {
    throw new ForbiddenException('Não foi possível identificar quem encerra a ação corretiva.')
  }
}

const SELF_RESOLUTION_MESSAGE = 'Não é permitido encerrar uma ação corretiva própria.'

@Injectable()
export class CorrectiveActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly operationalState: OperationalStateService,
    private readonly risk: RiskService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  async listByPerson(orgId: string, personId: string) {
    return this.prisma.correctiveAction.findMany({
      where: {
        personId,
        person: { orgId },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async resolve(orgId: string, id: string, actor: CorrectiveActionActor) {
    assertVerifiableActor(actor)

    const action = await this.prisma.correctiveAction.findFirst({
      where: {
        id,
        person: { orgId },
      },
    })

    if (!action) return null

    // Nobody closes a corrective action of their own person, ADMIN included. Before any write.
    if (action.personId === actor.personId) {
      throw new ForbiddenException(SELF_RESOLUTION_MESSAGE)
    }

    const person = await this.prisma.person.findFirst({
      where: { id: action.personId, orgId },
      select: { orgId: true },
    })

    if (!person) {
      throw new Error('CorrectiveActionsService.resolve(): person não encontrado')
    }

    const resolvedAt = new Date()

    const result = await this.prisma.correctiveAction.updateMany({
      where: {
        id,
        person: { orgId },
      },
      data: {
        status: 'DONE',
        resolvedAt,
      },
    })

    if (result.count === 0) return null

    const resolved = await this.prisma.correctiveAction.findFirst({
      where: { id, person: { orgId } },
    })

    if (!resolved) return null

    const recalculatedScore = await this.risk.recalculatePersonRisk(
      action.personId,
      `Corretiva resolvida (${action.reason})`,
    )

    const newStatus = await this.operationalState.getStatus(action.personId)

    await this.timeline.log({
      orgId: person.orgId,
      action: 'CORRECTIVE_ACTION_RESOLVED',
      personId: action.personId,
      description: action.reason,
      metadata: {
        resolvedAt,
        resultingState: newStatus.state,
        riskScore: newStatus.riskScore,
        recalculatedScore,
        requestId: this.requestContext.requestId,
      },
    })

    await this.audit.log({
      orgId,
      action: AUDIT_ACTIONS.CORRECTIVE_ACTION_RESOLVED,
      actorUserId: actor.userId,
      actorPersonId: actor.personId,
      entityType: 'CORRECTIVE_ACTION',
      entityId: resolved.id,
      context: 'Ação corretiva resolvida',
      metadata: { requestId: this.requestContext.requestId, personId: resolved.personId },
    })

    return resolved
  }

  async processReassessment(orgId: string, personId: string, actor: CorrectiveActionActor) {
    assertVerifiableActor(actor)

    // Same rule as resolve, checked against the target person before any lookup or write.
    if (personId === actor.personId) {
      throw new ForbiddenException(SELF_RESOLUTION_MESSAGE)
    }

    const lastOpen = await this.prisma.correctiveAction.findFirst({
      where: {
        personId,
        person: { orgId },
        status: 'OPEN',
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    if (!lastOpen) return { reassessed: true, resolved: false }

    const resolved = await this.resolve(orgId, lastOpen.id, actor)
    return {
      reassessed: true,
      resolved: !!resolved,
      correctiveActionId: lastOpen.id,
    }
  }
}
