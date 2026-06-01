import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'
import { AnalyticsService } from './analytics.service'

const ISO_DATE_TIME_WITH_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/

export function parseOptionalIsoDate(value?: string): Date | undefined {
  if (value === undefined) return undefined

  const match = ISO_DATE_TIME_WITH_OFFSET.exec(value)
  if (!match) throw new BadRequestException('Período deve usar data e hora ISO com offset')

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue, millisecondValue = '', offset] = match
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)
  const hour = Number(hourValue)
  const minute = Number(minuteValue)
  const second = Number(secondValue)
  const millisecond = Number(millisecondValue.padEnd(3, '0'))
  const calendarProbe = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond))

  if (
    calendarProbe.getUTCFullYear() !== year ||
    calendarProbe.getUTCMonth() !== month - 1 ||
    calendarProbe.getUTCDate() !== day ||
    calendarProbe.getUTCHours() !== hour ||
    calendarProbe.getUTCMinutes() !== minute ||
    calendarProbe.getUTCSeconds() !== second
  ) {
    throw new BadRequestException('Período inválido')
  }

  if (offset !== 'Z') {
    const offsetHours = Number(offset.slice(1, 3))
    const offsetMinutes = Number(offset.slice(4, 6))
    if (offsetHours > 23 || offsetMinutes > 59) throw new BadRequestException('Período inválido')
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Período inválido')
  return date
}

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * GET /analytics/usage
   * Retorna sumário de uso da organização
   */
  @Get('usage')
  @Roles('ADMIN')
  getUsage(
    @Org() orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getUsageSummary(
      orgId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    )
  }

  /**
   * GET /analytics/assignee-warning-summary
   * Resume os alertas passivos de atribuição manual da organização.
   */
  @Get('assignee-warning-summary')
  @Roles('ADMIN')
  getAssigneeWarningSummary(
    @Org() orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getAssigneeWarningSummary(
      orgId,
      parseOptionalIsoDate(from),
      parseOptionalIsoDate(to),
    )
  }

  /**
   * GET /analytics/daily
   * Retorna métricas diárias dos últimos N dias
   */
  @Get('daily')
  @Roles('ADMIN')
  getDaily(
    @Org() orgId: string,
    @Query('days') days?: string,
  ) {
    return this.analytics.getDailyMetrics(orgId, days ? Number(days) : 30)
  }

  /**
   * GET /analytics/saas-funnel
   * Funil interno de monetização e conversão
   */
  @Get('saas-funnel')
  @Roles('ADMIN', 'FINANCEIRO')
  getSaasFunnel(
    @Org() orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analytics.getSaasFunnel(
      orgId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    )
  }

  /**
   * POST /analytics/track
   * Registro de eventos de conversão do produto.
   */
  @Post('track')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'VIEWER')
  async trackProductEvent(
    @Org() orgId: string,
    @User('id') userId: string,
    @Body()
    body: {
      eventName?: string
      metadata?: Record<string, unknown>
    },
  ) {
    await this.analytics.trackProductEvent({
      orgId,
      userId,
      eventName: body?.eventName ?? '',
      metadata: body?.metadata ?? {},
    })

    return { ok: true }
  }
}
