import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UsageMetricEvent } from '@prisma/client'

export { UsageMetricEvent }

export interface TrackEventParams {
  orgId: string
  userId?: string
  event: UsageMetricEvent
  metadata?: Record<string, any>
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

  /**
   * Registra um evento de uso de produto.
   * Fire-and-forget: erros são logados mas não propagados.
   */
  async track(params: TrackEventParams): Promise<void> {
    try {
      await this.prisma.usageMetric.create({
        data: {
          orgId: params.orgId,
          userId: params.userId ?? null,
          event: params.event,
          metadata: params.metadata ?? {},
        },
      })
    } catch (err) {
      // Analytics nunca deve quebrar a operação principal
      this.logger.warn(`Falha ao registrar evento ${params.event}: ${err.message}`)
    }
  }

  /**
   * Retorna o sumário de uso de uma organização
   */
  async getUsageSummary(orgId: string, from?: Date, to?: Date) {
    const where: any = { orgId }
    if (from || to) {
      where.createdAt = {}
      if (from) where.createdAt.gte = from
      if (to) where.createdAt.lte = to
    }

    // Contagem por evento
    const eventCounts = await this.prisma.usageMetric.groupBy({
      by: ['event'],
      where,
      _count: { event: true },
      orderBy: { _count: { event: 'desc' } },
    })

    // Total de eventos
    const totalEvents = eventCounts.reduce((sum, e) => sum + e._count.event, 0)

    // Usuários únicos ativos
    const uniqueUsers = await this.prisma.usageMetric.findMany({
      where: { ...where, userId: { not: null } },
      select: { userId: true },
      distinct: ['userId'],
    })

    // Últimos 7 dias de atividade
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentActivity = await this.prisma.usageMetric.groupBy({
      by: ['event'],
      where: { orgId, createdAt: { gte: sevenDaysAgo } },
      _count: { event: true },
    })

    // Logins nos últimos 30 dias
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
      byEvent: eventCounts.map(e => ({
        event: e.event,
        count: e._count.event,
      })),
      recentActivity: recentActivity.map(e => ({
        event: e.event,
        count: e._count.event,
      })),
    }
  }

  /**
   * Retorna métricas de uso agregadas por dia (últimos N dias)
   */
  async getDailyMetrics(orgId: string, days = 30) {
    const from = new Date()
    from.setDate(from.getDate() - days)

    const metrics = await this.prisma.usageMetric.findMany({
      where: { orgId, createdAt: { gte: from } },
      select: { event: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    // Agrupar por dia
    const byDay: Record<string, Record<string, number>> = {}

    for (const m of metrics) {
      const day = m.createdAt.toISOString().split('T')[0]
      if (!byDay[day]) byDay[day] = {}
      byDay[day][m.event] = (byDay[day][m.event] ?? 0) + 1
    }

    return {
      orgId,
      days,
      from: from.toISOString(),
      data: Object.entries(byDay).map(([date, events]) => ({
        date,
        ...events,
        total: Object.values(events).reduce((s, v) => s + v, 0),
      })),
    }
  }

  /**
   * Retorna métricas globais para o painel de admin
   */
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
      byEvent: eventBreakdown.map(e => ({
        event: e.event,
        count: e._count.event,
      })),
    }
  }
}
