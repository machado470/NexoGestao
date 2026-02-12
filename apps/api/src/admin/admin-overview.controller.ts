import { Controller, Get } from '@nestjs/common'
import { AdminOverviewService } from './admin-overview.service'
import { Org } from '../auth/decorators/org.decorator'

@Controller('admin/overview')
export class AdminOverviewController {
  constructor(
    private readonly overview: AdminOverviewService,
  ) {}

  @Get()
  async get(@Org() orgId: string) {
    const data = await this.overview.getOverview(orgId)

    return {
      success: true,
      data,
    }
  }
}
