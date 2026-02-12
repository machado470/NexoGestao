import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TemporalRiskService } from './temporal-risk.service'

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly temporalRisk: TemporalRiskService,
  ) {}

  /**
   * Recalcula risco operacional (agregado) e persiste:
   * - Person.riskScore (cache)
   * - RiskSnapshot (histórico)
   * - TimelineEvent RISK_SNAPSHOT_CREATED (trilha explicável)
   */
  async recalculatePersonRisk(personId: string, reason?: string) {
    const score = await this.temporalRisk.calculate(personId)

    // ✅ cache persistido (dashboard, ordenação, filtros, etc)
    await this.prisma.person.update({
      where: { id: personId },
      data: { riskScore: score },
    })

    await this.snapshot(personId, score, reason)

    return score
  }

  async snapshot(personId: string, score: number, reason?: string) {
    const finalReason = reason?.trim() ? reason.trim() : 'Reavaliação automática'

    await this.prisma.riskSnapshot.create({
      data: {
        personId,
        score,
        reason: finalReason,
      },
    })

    await this.prisma.timelineEvent.create({
      data: {
        personId,
        action: 'RISK_SNAPSHOT_CREATED',
        metadata: { score, reason: finalReason },
      },
    })
  }
}
