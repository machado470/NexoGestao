import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class GovernanceReadService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async getLatestRun(orgId: string) {
    return this.prisma.governanceRun.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async listRuns(orgId: string, limit = 20) {
    return this.prisma.governanceRun.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async getSummary(orgId: string) {
    const last = await this.getLatestRun(orgId)

    const trend = await this.prisma.governanceRun.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 7,
      select: {
        createdAt: true,
        institutionalRiskScore: true,
        evaluated: true,
        warnings: true,
        correctives: true,
        restrictedCount: true,
        suspendedCount: true,
        openCorrectivesCount: true,
        durationMs: true,
      },
    })

    if (!last) {
      return {
        lastRunAt: null,
        evaluated: 0,
        warnings: 0,
        correctives: 0,
        institutionalRiskScore: 0,
        restrictedCount: 0,
        suspendedCount: 0,
        openCorrectivesCount: 0,
        durationMs: 0,
        trend: trend.reverse(),
      }
    }

    return {
      lastRunAt: last.createdAt,
      evaluated: last.evaluated,
      warnings: last.warnings,
      correctives: last.correctives,
      institutionalRiskScore: last.institutionalRiskScore,
      restrictedCount: last.restrictedCount,
      suspendedCount: last.suspendedCount,
      openCorrectivesCount: last.openCorrectivesCount,
      durationMs: last.durationMs,
      trend: trend.reverse(),
    }
  }

  async getAutoScore(orgId: string) {
    const [lastRun, peopleAgg] = await Promise.all([
      this.getLatestRun(orgId),
      this.prisma.person.aggregate({
        where: { orgId },
        _count: { id: true },
        _avg: { riskScore: true },
      }),
    ])

    const peopleCount = peopleAgg._count.id ?? 0
    const avgRiskScore = Math.round(peopleAgg._avg.riskScore ?? 0)

    const restrictedCount = await this.prisma.person.count({
      where: { orgId, operationalState: 'RESTRICTED' },
    })

    const suspendedCount = await this.prisma.person.count({
      where: { orgId, operationalState: 'SUSPENDED' },
    })

    const openCorrectivesCount = await this.prisma.correctiveAction.count({
      where: {
        status: 'OPEN',
        person: {
          orgId,
        },
      },
    })

    const governanceScore =
      lastRun?.institutionalRiskScore != null
        ? Math.max(0, 100 - lastRun.institutionalRiskScore)
        : Math.max(0, 100 - avgRiskScore)

    const level =
      governanceScore >= 90
        ? 'A'
        : governanceScore >= 75
          ? 'B'
          : governanceScore >= 60
            ? 'C'
            : governanceScore >= 40
              ? 'D'
              : 'E'

    return {
      score: governanceScore,
      level,
      lastUpdated: lastRun?.createdAt ?? null,
      source: lastRun ? 'GOVERNANCE_RUN' : 'LIVE_FALLBACK',
      factors: [
        {
          name: 'Risco institucional',
          value: lastRun?.institutionalRiskScore ?? avgRiskScore,
          reference: 'Quanto menor, melhor.',
        },
        {
          name: 'Pessoas avaliadas',
          value: lastRun?.evaluated ?? peopleCount,
          reference: 'Base considerada na leitura atual.',
        },
        {
          name: 'Restritos',
          value: lastRun?.restrictedCount ?? restrictedCount,
          reference: 'Pessoas em estado RESTRICTED.',
        },
        {
          name: 'Suspensos',
          value: lastRun?.suspendedCount ?? suspendedCount,
          reference: 'Pessoas em estado SUSPENDED.',
        },
        {
          name: 'Corretivas abertas',
          value: lastRun?.openCorrectivesCount ?? openCorrectivesCount,
          reference: 'Carga corretiva operacional ativa.',
        },
      ],
    }
  }
}
