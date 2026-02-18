import { Controller, Get, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ReportsService } from './reports.service'

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('executive-report')
  executiveReport(@Req() req: any) {
    if (!req?.user?.orgId) throw new UnauthorizedException()
    return this.service.getExecutiveReport(req.user.orgId)
  }

  @Get('metrics')
  metrics(@Req() req: any, @Query('days') days?: string) {
    if (!req?.user?.orgId) throw new UnauthorizedException()
    const n = days ? Number(days) : undefined
    return this.service.getExecutiveMetrics(
      req.user.orgId,
      Number.isFinite(n) ? n : undefined,
    )
  }
}
