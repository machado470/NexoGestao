import { BadRequestException, Injectable, Logger } from '@nestjs/common'
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
    'ASSIGNEE_WARNING_SHOWN',
    'ASSIGNEE_WARNING_CONFIRMED',
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
    const rawEventName = String(params.eventName ?? '').trim()
    const normalizedEvent = rawEventName.startsWith('ASSIGNEE_WARNING_')
      ? rawEventName.toUpperCase()
      : rawEventName.toLowerCase()

    if (!this.allowedProductEvents.has(normalizedEvent)) {
      throw new BadRequestException('Evento de produto não permitido')
    }

    const isAssigneeWarning = normalizedEvent.startsWith('ASSIGNEE_WARNING_')
    const metadata = isAssigneeWarning
      ? this.sanitizeAssigneeWarningMetadata(normalizedEvent, params.metadata)
      : params.metadata ?? {}

    await this.track({
      orgId: params.orgId,
      userId: params.userId,
      event: ((UsageMetricEvent as any)?.PRODUCT_EVENT ??
        (UsageMetricEvent as any)?.LOGIN) as UsageMetricEvent,
      metadata: {
        category: isAssigneeWarning ? 'passive_assignee_warning' : 'product_conversion',
        eventName: normalizedEvent,
        ...metadata,
      },
    })
  }

  private sanitizeAssigneeWarningMetadata(
    eventName: string,
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> {
    const context = metadata?.context
    const personId = metadata?.personId
    const warningTypes = metadata?.warningTypes
    const entityId = metadata?.entityId
    const allowedWarningTypes = new Set([
      'UNAVAILABLE_NOW',
      'UNAVAILABLE_SOON',
      'OVER_CAPACITY',
      'OVERLOADED',
    ])

    if (
      (context !== 'APPOINTMENT' && context !== 'SERVICE_ORDER') ||
      typeof personId !== 'string' ||
      personId.length === 0 ||
      personId.length > 100 ||
      !Array.isArray(warningTypes) ||
      warningTypes.length === 0 ||
      warningTypes.length > 4 ||
      warningTypes.some((warningType) => !allowedWarningTypes.has(String(warningType))) ||
      (eventName === 'ASSIGNEE_WARNING_SHOWN' && entityId !== undefined) ||
      (entityId !== undefined && (typeof entityId !== 'string' || entityId.length === 0 || entityId.length > 100))
    ) {
      throw new BadRequestException('Payload de alerta de atribuição inválido')
    }

    return {
      context,
      personId,
      warningTypes: [...new Set(warningTypes.map(String))],
      ...(entityId ? { entityId } : {}),
    }
  }

  async getAssigneeWarningSummary(orgId: string, from?: Date, to?: Date) {
    const periodTo = to ?? new Date()
    const periodFrom = from ?? new Date(periodTo.getTime() - 30 * 24 * 60 * 60 * 1000)

    if (Number.isNaN(periodFrom.getTime()) || Number.isNaN(periodTo.getTime())) {
      throw new BadRequestException('Período inválido')
    }

    if (periodFrom > periodTo) {
      throw new BadRequestException('O início do período deve ser anterior ao fim')
    }

    const metrics = await this.prisma.usageMetric.findMany({
      where: {
        orgId,
        createdAt: { gte: periodFrom, lte: periodTo },
        OR: [
          { metadata: { path: ['eventName'], equals: 'ASSIGNEE_WARNING_SHOWN' } },
          { metadata: { path: ['eventName'], equals: 'ASSIGNEE_WARNING_CONFIRMED' } },
        ],
      },
      select: { metadata: true },
    })

    const warningTypes = [
      'UNAVAILABLE_NOW',
      'UNAVAILABLE_SOON',
      'OVER_CAPACITY',
      'OVERLOADED',
    ] as const
    const contexts = ['APPOINTMENT', 'SERVICE_ORDER'] as const
    type WarningType = (typeof warningTypes)[number]
    type WarningContext = (typeof contexts)[number]
    type Counts = { shown: number; confirmed: number }

    const isWarningType = (value: unknown): value is WarningType =>
      warningTypes.includes(value as WarningType)
    const rate = ({ shown, confirmed }: Counts) =>
      shown === 0 ? null : Number(((confirmed / shown) * 100).toFixed(1))
    const emptyCounts = (): Counts => ({ shown: 0, confirmed: 0 })
    const totals = emptyCounts()
    const contextCounts = new Map<WarningContext, Counts>(
      contexts.map((context) => [context, emptyCounts()]),
    )
    const warningTypeCounts = new Map<WarningType, Counts>(
      warningTypes.map((warningType) => [warningType, emptyCounts()]),
    )
    const personCounts = new Map<string, Counts>()
    const combinationCounts = new Map<string, { warningTypes: WarningType[] } & Counts>()

    for (const metric of metrics) {
      const metadata = metric.metadata as Record<string, unknown> | null
      const eventName = metadata?.eventName
      const context = metadata?.context
      const personId = metadata?.personId
      const rawWarningTypes = metadata?.warningTypes

      if (
        metadata?.category !== 'passive_assignee_warning' ||
        (eventName !== 'ASSIGNEE_WARNING_SHOWN' && eventName !== 'ASSIGNEE_WARNING_CONFIRMED') ||
        (context !== 'APPOINTMENT' && context !== 'SERVICE_ORDER') ||
        typeof personId !== 'string' ||
        !Array.isArray(rawWarningTypes)
      ) {
        continue
      }

      const metricWarningTypes = [...new Set(rawWarningTypes.filter(isWarningType))].sort()
      if (metricWarningTypes.length === 0) continue

      const counter = eventName === 'ASSIGNEE_WARNING_SHOWN' ? 'shown' : 'confirmed'
      totals[counter] += 1
      contextCounts.get(context)![counter] += 1

      for (const warningType of metricWarningTypes) {
        warningTypeCounts.get(warningType)![counter] += 1
      }

      const personCount = personCounts.get(personId) ?? emptyCounts()
      personCount[counter] += 1
      personCounts.set(personId, personCount)

      const combinationKey = metricWarningTypes.join('|')
      const combinationCount = combinationCounts.get(combinationKey) ?? {
        warningTypes: metricWarningTypes,
        ...emptyCounts(),
      }
      combinationCount[counter] += 1
      combinationCounts.set(combinationKey, combinationCount)
    }

    const people = personCounts.size === 0
      ? []
      : await this.prisma.person.findMany({
        where: { orgId, id: { in: [...personCounts.keys()] } },
        select: { id: true, name: true },
      })
    const peopleNames = new Map(people.map((person) => [person.id, person.name]))
    const byCount = (left: Counts, right: Counts) =>
      right.shown - left.shown || right.confirmed - left.confirmed

    return {
      period: {
        from: periodFrom.toISOString(),
        to: periodTo.toISOString(),
      },
      totals: {
        ...totals,
        confirmationRatePct: rate(totals),
      },
      byContext: contexts.map((context) => {
        const counts = contextCounts.get(context)!
        return { context, ...counts, confirmationRatePct: rate(counts) }
      }),
      byWarningType: warningTypes.map((warningType) => ({
        warningType,
        ...warningTypeCounts.get(warningType)!,
      })),
      topPeople: [...personCounts.entries()]
        .map(([personId, counts]) => ({
          personId,
          name: peopleNames.get(personId) ?? null,
          ...counts,
        }))
        .sort(byCount)
        .slice(0, 10),
      commonCombinations: [...combinationCounts.values()]
        .sort(byCount)
        .slice(0, 10),
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
