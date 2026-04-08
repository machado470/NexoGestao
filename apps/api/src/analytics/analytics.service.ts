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

export interface TrackProductEventParams {
  orgId: string
  userId?: string
  eventName: string
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
  private readonly allowedProductEvents = new Set([
    'cta_click',
    'create_customer',
    'create_service_order',
    'generate_charge',
    'send_whatsapp',
    'payment_registered',
    'upgrade_click',
    'checkout_started',
    'checkout_completed',
  ])

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

  async trackProductEvent(params: TrackProductEventParams): Promise<void> {
    const normalizedEvent = String(params.eventName ?? '')
      .trim()
      .toLowerCase()

    if (!this.allowedProductEvents.has(normalizedEvent)) {
      this.logger.warn(`Evento de produto ignorado: ${params.eventName}`)
      return
    }

    await this.track({
      orgId: params.orgId,
      userId: params.userId,
      event: ((UsageMetricEvent as any)?.PRODUCT_EVENT ??
        (UsageMetricEvent as any)?.LOGIN) as UsageMetricEvent,
      metadata: {
        category: 'product_conversion',
        eventName: normalizedEvent,
        ...(params.metadata ?? {}),
      },
    })
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

  async getSaasFunnel(orgId: string, from?: Date, to?: Date) {
    const wherePeriod: { createdAt?: { gte?: Date; lte?: Date } } = {}

    if (from || to) {
      wherePeriod.createdAt = {}
      if (from) wherePeriod.createdAt.gte = from
      if (to) wherePeriod.createdAt.lte = to
    }

    const [customersCreated, serviceOrdersCreated, chargesCreated] =
      await Promise.all([
        this.prisma.customer.count({
          where: { orgId, ...wherePeriod },
        }),
        this.prisma.serviceOrder.count({
          where: { orgId, ...wherePeriod },
        }),
        this.prisma.charge.count({
          where: { orgId, ...wherePeriod },
        }),
      ])

    const serviceOrdersWithCustomer = await this.prisma.serviceOrder.findMany({
      where: { orgId, ...wherePeriod },
      select: { customerId: true },
      distinct: ['customerId'],
    })

    const paidCharges = await this.prisma.charge.count({
      where: {
        orgId,
        status: 'PAID',
        ...(wherePeriod.createdAt ? { paidAt: wherePeriod.createdAt } : {}),
      },
    })

    const pct = (num: number, den: number) =>
      den <= 0 ? 0 : Number(((num / den) * 100).toFixed(1))

    return {
      orgId,
      period: {
        from: from?.toISOString() ?? null,
        to: to?.toISOString() ?? null,
      },
      totals: {
        customersCreated,
        serviceOrdersCreated,
        chargesCreated,
        paidCharges,
      },
      conversions: {
        customerToServiceOrder: {
          value: serviceOrdersWithCustomer.length,
          percentage: pct(serviceOrdersWithCustomer.length, customersCreated),
        },
        serviceOrderToCharge: {
          value: chargesCreated,
          percentage: pct(chargesCreated, serviceOrdersCreated),
        },
        chargeToPaid: {
          value: paidCharges,
          percentage: pct(paidCharges, chargesCreated),
        },
      },
    }
  }
}
