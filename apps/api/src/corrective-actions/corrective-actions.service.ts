import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { OperationalStateService } from '../people/operational-state.service'
import { RiskService } from '../risk/risk.service'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { RequestContextService } from '../common/context/request-context.service'

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

  async resolve(orgId: string, id: string) {
    const action = await this.prisma.correctiveAction.findFirst({
      where: {
        id,
        person: { orgId },
      },
    })

    if (!action) return null

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
      actorUserId: this.requestContext.userId,
      actorPersonId: this.requestContext.personId,
      entityType: 'CORRECTIVE_ACTION',
      entityId: resolved.id,
      context: 'Ação corretiva resolvida',
      metadata: { requestId: this.requestContext.requestId, personId: resolved.personId },
    })

    return resolved
  }

  async processReassessment(orgId: string, personId: string) {
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

    const resolved = await this.resolve(orgId, lastOpen.id)
    return {
      reassessed: true,
      resolved: !!resolved,
      correctiveActionId: lastOpen.id,
    }
  }
}
