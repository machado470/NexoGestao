import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ExecutiveMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCorrectiveActionsSLA(days = 30) {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const actions =
      await this.prisma.correctiveAction.findMany({
        where: {
          createdAt: { gte: since },
          resolvedAt: { not: null },
        },
      })

    if (actions.length === 0) {
      return {
        windowDays: days,
        totalActions: 0,
        resolvedSamples: 0,
        closedSamples: 0,
        avgResolveHours: null,
        avgCloseHours: null,
      }
    }

    const resolveTimes = actions.map(
      a =>
        (a.resolvedAt!.getTime() -
          a.createdAt.getTime()) /
        36e5,
    )

    const avgResolveHours = Math.round(
      resolveTimes.reduce((a, b) => a + b, 0) /
        resolveTimes.length,
    )

    return {
      windowDays: days,
      totalActions: actions.length,
      resolvedSamples: actions.length,
      closedSamples: actions.length,
      avgResolveHours,
      avgCloseHours: avgResolveHours,
    }
  }
}
