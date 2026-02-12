import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { OperationalStateService } from '../people/operational-state.service'

@Injectable()
export class ExecutiveDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationalState: OperationalStateService,
  ) {}

  async getOverview(orgId: string) {
    const people = await this.prisma.person.findMany({
      where: { orgId, active: true },
      select: { id: true },
    })

    let normal = 0
    let warning = 0
    let restricted = 0
    let suspended = 0

    let totalRisk = 0

    for (const p of people) {
      const status = await this.operationalState.getStatus(p.id)

      totalRisk += status.riskScore

      if (status.state === 'NORMAL') normal++
      if (status.state === 'WARNING') warning++
      if (status.state === 'RESTRICTED') restricted++
      if (status.state === 'SUSPENDED') suspended++
    }

    // ✅ corretivas APENAS desta org (via relação person)
    const openCorrectives =
      await this.prisma.correctiveAction.count({
        where: {
          status: 'OPEN',
          person: { orgId },
        },
      })

    return {
      people: {
        total: people.length,
        normal,
        warning,
        restricted,
        suspended,
      },
      risk: {
        average:
          people.length === 0
            ? 0
            : Math.round(totalRisk / people.length),
      },
      correctiveActions: {
        open: openCorrectives,
      },
    }
  }
}
