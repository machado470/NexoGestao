import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TemporalRiskService } from '../risk/temporal-risk.service'
import { TimelineService } from '../timeline/timeline.service'

@Injectable()
export class OperationalStateJob {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(TemporalRiskService)
    private readonly temporalRisk: TemporalRiskService,

    @Inject(TimelineService)
    private readonly timeline: TimelineService,
  ) {}

  async run() {
    const persons = await this.prisma.person.findMany({
      where: { active: true },
      select: { id: true },
    })

    for (const p of persons) {
      const riskScore = await this.temporalRisk.calculate(p.id)

      const state =
        riskScore >= 90
          ? 'SUSPENDED'
          : riskScore >= 70
          ? 'RESTRICTED'
          : riskScore >= 50
          ? 'WARNING'
          : 'NORMAL'

      // 🔍 SENSOR: apenas registra o estado calculado
      await this.timeline.log({
        action: 'OPERATIONAL_STATE_EVALUATED',
        personId: p.id,
        description: `Estado operacional recalculado: ${state}`,
        metadata: {
          riskScore,
          state,
          source: 'OPERATIONAL_STATE_JOB',
        },
      })
    }
  }
}
