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
}
