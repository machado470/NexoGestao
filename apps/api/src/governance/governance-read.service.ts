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

    if (!last) {
      return {
        lastRunAt: null,
        evaluated: 0,
        warnings: 0,
        correctives: 0,
      }
    }

    return {
      lastRunAt: last.createdAt,
      evaluated: last.evaluated,
      warnings: last.warnings,
      correctives: last.correctives,
    }
  }
}
