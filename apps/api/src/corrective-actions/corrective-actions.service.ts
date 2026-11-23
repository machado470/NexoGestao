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

    // C8 PR3-3B-3: the closing and its audit are one transaction.
    // - CA-4: only an OPEN action is closed. The status condition is part of the single conditional
    //   UPDATE, so of concurrent or repeated requests exactly one changes the row; the others get
    //   count 0 and stop here with no audit, recalculation or timeline.
    // - CA-5 (minimal): if the audit write fails, the update is rolled back, the action stays OPEN
    //   and a retry closes and audits it once. AuditService.log has no transaction client, so the
    //   row is written with the same fields and defaults it uses (orgId from the session, author
    //   from the session actor, never from the request body).
    const resolved = await this.prisma.$transaction(async (tx) => {
      const result = await tx.correctiveAction.updateMany({
        where: {
          id,
          person: { orgId },
          status: 'OPEN',
        },
        data: {
          status: 'DONE',
          resolvedAt,
        },
      })

      if (result.count === 0) return null

      const closed = await tx.correctiveAction.findFirst({
        where: { id, person: { orgId } },
      })

      // The row was just updated in this transaction: not finding it is an inconsistency. Throw so
      // the transaction rolls back, instead of leaving an action DONE without its audit.
      if (!closed) {
        throw new Error('CorrectiveActionsService.resolve(): ação atualizada não encontrada na transação')
      }

      await tx.auditEvent.create({
        data: {
          orgId,
          action: AUDIT_ACTIONS.CORRECTIVE_ACTION_RESOLVED,
          actorUserId: actor.userId,
          actorPersonId: actor.personId,
          personId: null,
          entityType: 'CORRECTIVE_ACTION',
          entityId: closed.id,
          context: 'Ação corretiva resolvida',
          metadata: { requestId: this.requestContext.requestId, personId: closed.personId },
        },
      })

      return closed
    })

    if (!resolved) return null

    // After the commit, outside the transaction: the risk recalculation opens its own transaction
    // (operational state CAS), so it cannot be nested here. Unchanged order and content.
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
