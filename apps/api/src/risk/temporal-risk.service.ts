import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export type RiskContributor =
  | 'LOW_AVG_PROGRESS'
  | 'VERY_LOW_AVG_PROGRESS'
  | 'HAS_OPEN_CORRECTIVES'
  | 'HAS_MANY_OPEN_CORRECTIVES'

export type TemporalRiskResult = {
  score: number
  factors: {
    avgProgress: number
    openCorrectives: number
  }
  contributors: RiskContributor[]
}

@Injectable()
export class TemporalRiskService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async calculate(personId: string): Promise<number> {
    const detailed = await this.calculateDetailed(personId)
    return detailed.score
  }

  async calculateDetailed(
    personId: string,
  ): Promise<TemporalRiskResult> {
    const openCorrectives =
      await this.prisma.correctiveAction.count({
        where: {
          personId,
          status: 'OPEN',
        },
      })

    const assignments =
      await this.prisma.assignment.findMany({
        where: { personId },
        select: { progress: true },
      })

    const avgProgress =
      assignments.length === 0
        ? 100
        : assignments.reduce(
            (s, a) => s + a.progress,
            0,
          ) / assignments.length

    let score = 0
    const contributors: RiskContributor[] = []

    if (avgProgress < 80) {
      score += 30
      contributors.push('LOW_AVG_PROGRESS')
    }

    if (avgProgress < 50) {
      score += 30
      contributors.push('VERY_LOW_AVG_PROGRESS')
    }

    if (openCorrectives > 0) {
      score += 20
      contributors.push('HAS_OPEN_CORRECTIVES')
    }

    if (openCorrectives > 2) {
      score += 20
      contributors.push('HAS_MANY_OPEN_CORRECTIVES')
    }

    return {
      score: Math.min(100, Math.round(score)),
      factors: {
        avgProgress: Math.round(avgProgress),
        openCorrectives,
      },
      contributors,
    }
  }
}
