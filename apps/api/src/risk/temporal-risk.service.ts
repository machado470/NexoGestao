import { Injectable } from '@nestjs/common'
import { OperationalStateValue } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export type RiskContributor =
  | 'LOW_AVG_PROGRESS'
  | 'VERY_LOW_AVG_PROGRESS'
  | 'HAS_OPEN_CORRECTIVES'
  | 'HAS_MANY_OPEN_CORRECTIVES'

export type TemporalRiskFactorBreakdown = {
  code: RiskContributor
  label: string
  description: string
  points: number
  value: number
  threshold?: number
}

export type TemporalRiskResult = {
  score: number
  state: OperationalStateValue
  factors: {
    avgProgress: number
    openCorrectives: number
  }
  contributors: RiskContributor[]
  breakdown: TemporalRiskFactorBreakdown[]
  explanation: string[]
}

@Injectable()
export class TemporalRiskService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(personId: string): Promise<number> {
    const detailed = await this.calculateDetailed(personId)
    return detailed.score
  }

  async calculateDetailed(personId: string): Promise<TemporalRiskResult> {
    const openCorrectives = await this.prisma.correctiveAction.count({
      where: {
        personId,
        status: 'OPEN',
      },
    })

    const assignments = await this.prisma.assignment.findMany({
      where: { personId },
      select: { progress: true },
    })

    const avgProgress =
      assignments.length === 0
        ? 100
        : assignments.reduce((sum, assignment) => sum + assignment.progress, 0) /
          assignments.length

    const roundedAvgProgress = Math.round(avgProgress)

    let score = 0
    const contributors: RiskContributor[] = []
    const breakdown: TemporalRiskFactorBreakdown[] = []

    if (roundedAvgProgress < 80) {
      score += 30
      contributors.push('LOW_AVG_PROGRESS')
      breakdown.push({
        code: 'LOW_AVG_PROGRESS',
        label: 'Progresso médio abaixo do esperado',
        description:
          'A média de progresso dos assignments ficou abaixo de 80%.',
        points: 30,
        value: roundedAvgProgress,
        threshold: 80,
      })
    }

    if (roundedAvgProgress < 50) {
      score += 30
      contributors.push('VERY_LOW_AVG_PROGRESS')
      breakdown.push({
        code: 'VERY_LOW_AVG_PROGRESS',
        label: 'Progresso médio criticamente baixo',
        description:
          'A média de progresso dos assignments ficou abaixo de 50%.',
        points: 30,
        value: roundedAvgProgress,
        threshold: 50,
      })
    }

    if (openCorrectives > 0) {
      score += 20
      contributors.push('HAS_OPEN_CORRECTIVES')
      breakdown.push({
        code: 'HAS_OPEN_CORRECTIVES',
        label: 'Há ações corretivas em aberto',
        description:
          'Existe pelo menos uma ação corretiva aberta para a pessoa.',
        points: 20,
        value: openCorrectives,
        threshold: 1,
      })
    }

    if (openCorrectives > 2) {
      score += 20
      contributors.push('HAS_MANY_OPEN_CORRECTIVES')
      breakdown.push({
        code: 'HAS_MANY_OPEN_CORRECTIVES',
        label: 'Há muitas ações corretivas em aberto',
        description: 'A pessoa possui mais de 2 ações corretivas abertas.',
        points: 20,
        value: openCorrectives,
        threshold: 3,
      })
    }

    const finalScore = Math.min(100, Math.round(score))
    const state = this.deriveOperationalState(finalScore)

    return {
      score: finalScore,
      state,
      factors: {
        avgProgress: roundedAvgProgress,
        openCorrectives,
      },
      contributors,
      breakdown,
      explanation: this.buildExplanation({
        score: finalScore,
        state,
        avgProgress: roundedAvgProgress,
        openCorrectives,
        breakdown,
      }),
    }
  }

  deriveOperationalState(score: number): OperationalStateValue {
    if (score >= 90) return 'SUSPENDED'
    if (score >= 70) return 'RESTRICTED'
    if (score >= 50) return 'WARNING'
    return 'NORMAL'
  }

  private buildExplanation(params: {
    score: number
    state: OperationalStateValue
    avgProgress: number
    openCorrectives: number
    breakdown: TemporalRiskFactorBreakdown[]
  }): string[] {
    const lines: string[] = [
      `Score final ${params.score}, estado operacional ${params.state}.`,
      `Progresso médio atual: ${params.avgProgress}%.`,
      `Ações corretivas abertas: ${params.openCorrectives}.`,
    ]

    if (params.breakdown.length === 0) {
      lines.push('Nenhum fator de risco relevante foi identificado no cálculo atual.')
      return lines
    }

    for (const item of params.breakdown) {
      lines.push(`${item.label}: +${item.points} pontos.`)
    }

    return lines
  }
}
