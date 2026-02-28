import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { GovernanceRunService } from './governance-run.service'

@Injectable()
export class GovernanceRunJob {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(GovernanceRunService)
    private readonly run: GovernanceRunService,
  ) {}

  async runAllOrgs() {
    const orgs = await this.prisma.organization.findMany({
      select: { id: true },
    })

    let orgsEvaluated = 0

    for (const org of orgs) {
      orgsEvaluated++
      await this.runForOrg(org.id)
    }

    console.log(
      `[GovernanceRunJob] orgs=${orgsEvaluated} at=${new Date().toISOString()}`,
    )
  }

  async runForOrg(orgId: string) {
    this.run.startRun(orgId)

    const evaluated = await this.prisma.person.count({
      where: { orgId, active: true },
    })

    const byState = await this.prisma.person.groupBy({
      by: ['operationalState'],
      where: { orgId, active: true },
      _count: { _all: true },
    })

    const warnings =
      byState.find((x) => x.operationalState === 'WARNING')?._count._all ?? 0
    const restrictedCount =
      byState.find((x) => x.operationalState === 'RESTRICTED')?._count._all ?? 0
    const suspendedCount =
      byState.find((x) => x.operationalState === 'SUSPENDED')?._count._all ?? 0

    const agg = await this.prisma.person.aggregate({
      where: { orgId, active: true },
      _avg: { operationalRiskScore: true },
    })

    const institutionalRiskScore = Math.min(
      100,
      Math.max(0, Math.round(agg._avg.operationalRiskScore ?? 0)),
    )

    const openCorrectivesCount = await this.prisma.correctiveAction.count({
      where: {
        status: 'OPEN',
        person: { orgId },
      },
    })

    await this.run.finishWithAggregates({
      orgId,
      evaluated,
      warnings,
      correctives: 0,
      institutionalRiskScore,
      restrictedCount,
      suspendedCount,
      openCorrectivesCount,
    })
  }
}
