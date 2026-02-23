import { Controller, Get, UnauthorizedException, UseGuards } from '@nestjs/common'
import { FinanceService } from './finance.service'
import { Org } from '../auth/decorators/org.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('overview')
  async overview(@Org() orgId: string | null) {
    if (!orgId) {
      throw new UnauthorizedException('Missing orgId')
    }
    return this.finance.overview(orgId)
  }
}
