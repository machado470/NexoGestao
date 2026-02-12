import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ExecutiveDashboardService } from './executive-dashboard.service'

@Controller('reports/executive')
@UseGuards(JwtAuthGuard)
export class ExecutiveDashboardController {
  constructor(private readonly dashboard: ExecutiveDashboardService) {}

  @Get()
  overview(@Req() req: any) {
    if (!req?.user?.orgId) throw new UnauthorizedException()
    return this.dashboard.getOverview(req.user.orgId)
  }
}
