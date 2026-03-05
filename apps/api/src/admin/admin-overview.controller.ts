import { Controller, Get, UseGuards } from '@nestjs/common'
import { AdminOverviewService } from './admin-overview.service'
import { Org } from '../auth/decorators/org.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/overview')
export class AdminOverviewController {
  constructor(
    private readonly overview: AdminOverviewService,
  ) {}

  @Get()
  @Roles('ADMIN')
  async get(@Org() orgId: string) {
    const data = await this.overview.getOverview(orgId)

    return {
      success: true,
      data,
    }
  }
}
