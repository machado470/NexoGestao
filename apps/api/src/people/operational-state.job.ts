import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { RiskService } from '../risk/risk.service'
import { OperationalStateRepository } from './operational-state.repository'
import type { OperationalStateValue } from './operational-state.service'

function deriveState(riskScore: number): OperationalStateValue {
  if (riskScore >= 90) return 'SUSPENDED'
  if (riskScore >= 70) return 'RESTRICTED'
  if (riskScore >= 50) return 'WARNING'
  return 'NORMAL'
}

@Injectable()
export class OperationalStateJob {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(TimelineService)
    private readonly timeline: TimelineService,

    @Inject(RiskService)
    private readonly risk: RiskService,

    @Inject(OperationalStateRepository)
    private readonly repo: OperationalStateRepository,
  ) {}

  async run() {
    const persons = await this.prisma.person.findMany({
      where: { active: true },
      select: { id: true, orgId: true },
    })

    for (const p of persons) {
      // RiskService retorna NUMBER (score)
      const riskScore = await this.risk.recalculatePersonRisk(
        p.id,
        'OPERATIONAL_STATE_JOB',
      )

      const nextState = deriveState(riskScore)
      const lastState = await this.repo.getLastState(p.id)

      // Anti-spam: só registra quando muda
      if (lastState && lastState === nextState) continue

      await this.timeline.log({
        orgId: p.orgId,
        action: 'OPERATIONAL_STATE_CHANGED',
        personId: p.id,
        description: `Estado operacional: ${(lastState ?? 'UNKNOWN')} → ${nextState}`,
        metadata: {
          from: lastState ?? 'UNKNOWN',
          to: nextState,
          riskScore,
          source: 'OPERATIONAL_STATE_JOB',
        },
      })
    }
  }
}
