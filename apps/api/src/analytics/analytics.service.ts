import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UsageMetricEvent } from '@prisma/client'

export { UsageMetricEvent }

export interface TrackEventParams {
  orgId: string
  userId?: string
  event: UsageMetricEvent
  metadata?: Record<string, unknown>
}

export interface UsageQueryParams {
  orgId: string
  from?: Date
  to?: Date
  event?: UsageMetricEvent
  groupBy?: 'day' | 'week' | 'month'
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async track(params: TrackEventParams): Promise<void> {
    try {
      await this.prisma.usageMetric.create({
        data: {
          orgId: params.orgId,
          userId: params.userId ?? null,
          event: params.event as any,
          metadata: (params.metadata ?? {}) as any,
        },
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      this.logger.warn(
        `Falha ao registrar evento ${params.event}: ${message}`,
      )
    }
  }

  async getUsageSummary(orgId: string, from?: Date, to?: Date) {
    const where: any = { orgId }

    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lte = to
    }

    const eventCounts = await this.prisma.usageMetric.groupBy({
      by: ['event'],
      where,
      _count: { event: true },
      orderBy: { _count: { event: 'desc' } },
    })

    const totalEvents = eventCounts.reduce((sum, entry) => {
      return sum + entry._count.event
    }, 0)

    const uniqueUsers = await this.prisma.usageMetric.findMany({
      where: {
        ...where,
        userId: { not: null },
      },
      select: { userId: true },
      distinct: ['userId'],
    })

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentActivity = await this.prisma.usageMetric.groupBy({
      by: ['event'],
      where: {
        orgId,
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { event: true },
    })

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const loginCount = await this.prisma.usageMetric.count({
      where: {
        orgId,
        event: UsageMetricEvent.LOGIN,
        createdAt: { gte: thirtyDaysAgo },
      },
    })

    return {
      orgId,
      period: {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
      summary: {
        totalEvents,
        uniqueActiveUsers: uniqueUsers.length,
        loginsLast30Days: loginCount,
      },
      byEvent: eventCounts.map((entry) => ({
        event: entry.event,
        count: entry._count.event,
      })),
      recentActivity: recentActivity.map((entry) => ({
        event: entry.event,
        count: entry._count.event,
      })),
    }
  }

  async getDailyMetrics(orgId: string, days = 30) {
    const from = new Date()
    from.setDate(from.getDate() - days)

    const metrics = await this.prisma.usageMetric.findMany({
      where: { orgId, createdAt: { gte: from } },
      select: { event: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const byDay: Record<string, Record<string, number>> = {}

    for (const metric of metrics) {
      const day = metric.createdAt.toISOString().split('T')[0]

      if (!byDay[day]) {
        byDay[day] = {}
      }

      byDay[day][metric.event] = (byDay[day][metric.event] ?? 0) + 1
    }

    return {
      orgId,
      days,
      from: from.toISOString(),
      data: Object.entries(byDay).map(([date, events]) => ({
        date,
        ...events,
        total: Object.values(events).reduce((sum, value) => sum + value, 0),
      })),
    }
  }

  async getGlobalMetrics(from?: Date, to?: Date) {
    const where: any = {}

    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lte = to
    }

    const [totalEvents, totalOrgs, eventBreakdown] = await Promise.all([
      this.prisma.usageMetric.count({ where }),
      this.prisma.usageMetric.findMany({
        where,
        select: { orgId: true },
        distinct: ['orgId'],
      }),
      this.prisma.usageMetric.groupBy({
        by: ['event'],
        where,
        _count: { event: true },
        orderBy: { _count: { event: 'desc' } },
      }),
    ])

    return {
      totalEvents,
      activeOrgs: totalOrgs.length,
      byEvent: eventBreakdown.map((entry) => ({
        event: entry.event,
        count: entry._count.event,
      })),
    }
  }
}
