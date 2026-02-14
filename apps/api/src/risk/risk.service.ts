import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TemporalRiskService } from './temporal-risk.service'
import { TimelineService } from '../timeline/timeline.service'

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly temporalRisk: TemporalRiskService,
    private readonly timeline: TimelineService,
  ) {}

  async recalculatePersonRisk(personId: string, reason?: string) {
    const score = await this.temporalRisk.calculate(personId)

    await this.prisma.person.update({
      where: { id: personId },
      data: { riskScore: score },
    })

    await this.snapshot(personId, score, reason)

    return score
  }

  async snapshot(personId: string, score: number, reason?: string) {
    const finalReason = reason?.trim() ? reason.trim() : 'Reavaliação automática'

    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      select: { orgId: true },
    })

    if (!person) {
      throw new Error('RiskService.snapshot(): person não encontrado')
    }

    await this.prisma.riskSnapshot.create({
      data: {
        personId,
        score,
        reason: finalReason,
      },
    })

    await this.timeline.log({
      orgId: person.orgId,
      personId,
      action: 'RISK_SNAPSHOT_CREATED',
      metadata: { score, reason: finalReason },
    })
  }
}
