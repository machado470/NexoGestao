import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ExecutiveMetricsService } from './executive-metrics.service'
import { TimelineService } from '../timeline/timeline.service'
import { OperationalStateService } from '../people/operational-state.service'

type Urgency = 'OK' | 'WARNING' | 'CRITICAL'

type NextAction =
  | {
      type: 'RESOLVE_CORRECTIVE'
      count: number
    }
  | {
      type: 'START_ASSIGNMENT'
      assignmentId: string
      trackId: string
      trackTitle: string
    }
  | {
      type: 'NONE'
    }

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: ExecutiveMetricsService,
    private readonly timeline: TimelineService,
    private readonly operationalState: OperationalStateService,
  ) {}

  private urgencyFromState(
    state: 'NORMAL' | 'WARNING' | 'RESTRICTED' | 'SUSPENDED',
  ): Urgency {
    if (state === 'WARNING') return 'WARNING'
    if (state === 'RESTRICTED' || state === 'SUSPENDED') return 'CRITICAL'
    return 'OK'
  }

  private buildReason(factors: {
    avgProgress: number
    openCorrectives: number
  }): string {
    const parts: string[] = []

    // progresso médio (se não for 100, tem algo pra fazer)
    if (factors.avgProgress < 100) {
      parts.push(`Progresso médio ${factors.avgProgress}% nas trilhas`)
    }

    // corretivas abertas (se houver)
    if (factors.openCorrectives > 0) {
      const n = factors.openCorrectives
      parts.push(`${n} corretiva${n === 1 ? '' : 's'} aberta${n === 1 ? '' : 's'}`)
    }

    if (parts.length === 0) return 'Sem pendências relevantes no momento'
    return parts.join(' • ')
  }

  private async buildNextAction(
    personId: string,
    factors: { avgProgress: number; openCorrectives: number },
  ): Promise<NextAction> {
    // Regra de ouro: corretiva aberta manda no fluxo (é “apagar incêndio” antes de estudar mais).
    if (factors.openCorrectives > 0) {
      return { type: 'RESOLVE_CORRECTIVE', count: factors.openCorrectives }
    }

    // “Próxima ação” pragmática: existe assignment pendente? então é começar/continuar ele.
    // (Start/Continue na UI é a mesma coisa: abrir o assignment e seguir o fluxo)
    const pending = await this.prisma.assignment.findFirst({
      where: {
        personId,
        progress: { lt: 100 },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        track: { select: { id: true, title: true } },
      },
    })

    if (!pending?.track) return { type: 'NONE' }

    return {
      type: 'START_ASSIGNMENT',
      assignmentId: pending.id,
      trackId: pending.track.id,
      trackTitle: pending.track.title,
    }
  }

  async getExecutiveReport(orgId: string) {
    const people = await this.prisma.person.findMany({
      where: { orgId },
      select: { id: true, name: true },
    })

    const peopleStats: Record<Urgency, number> = {
      OK: 0,
      WARNING: 0,
      CRITICAL: 0,
    }

    const peopleView: Array<{
      id: string
      name: string
      status: Urgency
      state: 'NORMAL' | 'WARNING' | 'RESTRICTED' | 'SUSPENDED'
      riskScore: number
      contributors: string[]
      factors: { avgProgress: number; openCorrectives: number }
      reason: string
      nextAction: NextAction
    }> = []

    for (const p of people) {
      const os = await this.operationalState.getStatusDetailed(p.id)

      const status = this.urgencyFromState(os.state)
      peopleStats[status]++

      const reason = this.buildReason(os.factors)

      // Só calcula nextAction se tem algum sinal de risco/pendência.
      // (evita query extra em gente 100% ok)
      const nextAction =
        status === 'OK' &&
        os.factors.avgProgress === 100 &&
        os.factors.openCorrectives === 0
          ? ({ type: 'NONE' } as NextAction)
          : await this.buildNextAction(p.id, os.factors)

      peopleView.push({
        id: p.id,
        name: p.name,
        status,
        state: os.state,
        riskScore: os.riskScore,
        contributors: os.contributors,
        factors: os.factors,
        reason,
        nextAction,
      })
    }

    const correctiveOpenCount = await this.prisma.correctiveAction.count({
      where: {
        status: 'OPEN',
        person: { orgId },
      },
    })

    const tracks = await this.prisma.track.findMany({
      where: { orgId },
      include: { assignments: true },
      orderBy: { createdAt: 'desc' },
    })

    const tracksView = tracks.map(t => {
      const count = t.assignments.length
      const rate =
        count === 0
          ? 0
          : Math.round(t.assignments.reduce((s, a) => s + a.progress, 0) / count)

      let status: 'SUCCESS' | 'WARNING' | 'CRITICAL' = 'SUCCESS'
      if (rate < 40) status = 'CRITICAL'
      else if (rate < 80) status = 'WARNING'

      return {
        id: t.id,
        title: t.title,
        peopleCount: count,
        completionRate: rate,
        status,
      }
    })

    // ✅ Multi-tenant correto: timeline sempre por org
    const timeline = await this.timeline.listByOrg(orgId)

    return {
      peopleStats,
      correctiveOpenCount,
      people: peopleView,
      tracks: tracksView,
      timeline,
    }
  }

  async getExecutiveMetrics(days = 30) {
    return this.metrics.getCorrectiveActionsSLA(days)
  }
}
