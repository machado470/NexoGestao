import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ExecutiveDashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getOverview(orgId: string) {
    // Total de pessoas ativas na organização
    const peopleTotal = await this.prisma.person.count({
      where: { orgId, active: true },
    })

    // Último ciclo de governança
    const lastRun = await this.prisma.governanceRun.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        evaluated: true,
        warnings: true,
        correctives: true,
        institutionalRiskScore: true,
        restrictedCount: true,
        suspendedCount: true,
        openCorrectivesCount: true,
        durationMs: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    })

    // Tendência (últimos 14 ciclos)
    const trend = await this.prisma.governanceRun.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 14,
      select: {
        createdAt: true,
        institutionalRiskScore: true,
        openCorrectivesCount: true,
        restrictedCount: true,
        suspendedCount: true,
        evaluated: true,
        durationMs: true,
        finishedAt: true,
      },
    })

    if (!lastRun) {
      return {
        people: {
          total: peopleTotal,
          restricted: 0,
          suspended: 0,
        },
        risk: { average: 0 },
        correctiveActions: { open: 0 },
        lastRun: null,
        trend,
      }
    }

    return {
      people: {
        total: peopleTotal,
        restricted: lastRun.restrictedCount,
        suspended: lastRun.suspendedCount,
      },
      risk: {
        average: lastRun.institutionalRiskScore,
      },
      correctiveActions: {
        open: lastRun.openCorrectivesCount,
      },
      lastRun: {
        createdAt: lastRun.createdAt,
        startedAt: lastRun.startedAt,
        finishedAt: lastRun.finishedAt,
        durationMs: lastRun.durationMs,
        evaluated: lastRun.evaluated,
        warnings: lastRun.warnings,
        correctives: lastRun.correctives,
        institutionalRiskScore: lastRun.institutionalRiskScore,
      },
      trend,
    }
  }
}
