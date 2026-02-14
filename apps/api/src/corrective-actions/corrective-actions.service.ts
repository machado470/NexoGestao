import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { OperationalStateService } from '../people/operational-state.service'
import { RiskService } from '../risk/risk.service'

@Injectable()
export class CorrectiveActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly operationalState: OperationalStateService,
    private readonly risk: RiskService,
  ) {}

  async listByPerson(personId: string) {
    return this.prisma.correctiveAction.findMany({
      where: { personId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async resolve(id: string) {
    const action = await this.prisma.correctiveAction.findUnique({
      where: { id },
    })

    if (!action) return null

    const person = await this.prisma.person.findUnique({
      where: { id: action.personId },
      select: { orgId: true },
    })

    if (!person) {
      throw new Error('CorrectiveActionsService.resolve(): person não encontrado')
    }

    const resolvedAt = new Date()

    const resolved = await this.prisma.correctiveAction.update({
      where: { id },
      data: {
        status: 'DONE',
        resolvedAt,
      },
    })

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
      },
    })

    return resolved
  }

  async processReassessment(personId: string) {
    const lastOpen = await this.prisma.correctiveAction.findFirst({
      where: {
        personId,
        status: 'OPEN',
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    if (!lastOpen) return { reassessed: true, resolved: false }

    const resolved = await this.resolve(lastOpen.id)
    return {
      reassessed: true,
      resolved: !!resolved,
      correctiveActionId: lastOpen.id,
    }
  }
}
