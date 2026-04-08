import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { AnalyticsService } from './analytics.service'

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
}
