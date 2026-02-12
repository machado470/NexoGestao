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

    const resolvedAt = new Date()

    const resolved = await this.prisma.correctiveAction.update({
      where: { id },
      data: {
        status: 'DONE',
        resolvedAt,
      },
    })

    // ✅ Recalcula risco operacional (persiste Person.riskScore + RiskSnapshot + Timeline snapshot)
    const recalculatedScore = await this.risk.recalculatePersonRisk(
      action.personId,
      `Corretiva resolvida (${action.reason})`,
    )

    // 🔄 Reavaliar estado operacional (fonte única)
    const newStatus = await this.operationalState.getStatus(action.personId)

    // 🧾 Linha do tempo explicável (fechamento da corretiva)
    await this.timeline.log({
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

  /**
   * 🔁 Compatibilidade explícita (personId)
   * - Usado pelo endpoint /corrective-actions/person/:personId/reassess
   * - Resolve a última ação corretiva OPEN daquela pessoa (se existir)
   */
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
