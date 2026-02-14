import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class GovernanceReadService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async getLatestRun() {
    return this.prisma.governanceRun.findFirst({
      orderBy: { createdAt: 'desc' },
    })
  }

  async listRuns(limit = 20) {
    return this.prisma.governanceRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async getSummary() {
    const last = await this.getLatestRun()

    const trend = await this.prisma.governanceRun.findMany({
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

      institutionalRiskScore: (last as any).institutionalRiskScore ?? 0,
      restrictedCount: (last as any).restrictedCount ?? 0,
      suspendedCount: (last as any).suspendedCount ?? 0,
      openCorrectivesCount: (last as any).openCorrectivesCount ?? 0,
      durationMs: (last as any).durationMs ?? 0,

      // ordem cronológica (velho -> novo) pra gráfico
      trend: trend.reverse(),
    }
  }
}
