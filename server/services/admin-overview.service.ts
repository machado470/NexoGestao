import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getOverview(orgId: string) {
    if (!orgId) {
      return {
        total: 0,
        critical: 0,
        warning: 0,
        governance: null,
      }
    }

    const total = await this.prisma.person.count({
      where: { orgId },
    })

    const critical =
      await this.prisma.correctiveAction.count({
        where: {
          person: { orgId },
          status: 'OPEN',
        },
      })

    const warning =
      await this.prisma.assignment.count({
        where: {
          person: { orgId },
          progress: { lt: 100 },
        },
      })

    const lastGovernance =
      await this.prisma.governanceRun.findFirst({
        orderBy: { createdAt: 'desc' },
      })

    return {
      total,
      critical,
      warning,
      governance: lastGovernance
        ? {
            ranAt: lastGovernance.createdAt,
            evaluated: lastGovernance.evaluated,
            warnings: lastGovernance.warnings,
            correctives: lastGovernance.correctives,
          }
        : null,
    }
  }
}
