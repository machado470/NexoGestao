import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TimelineService } from './timeline.service'
import { Org } from '../auth/decorators/org.decorator'
import { TimelineQueryDto } from './dto/timeline-query.dto'

@Controller('timeline')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get()
  async listByOrg(@Org() orgId: string, @Query() query: TimelineQueryDto) {
    const data = await this.timeline.listByOrg(orgId, query)
    return { ok: true, data }
  }

  @Get('customers/:customerId')
  async listByCustomer(
    @Org() orgId: string,
    @Param('customerId') customerId: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.timeline.listByCustomerInOrg(
      orgId,
      customerId,
      limit ? Number(limit) : 100,
    )
    return { ok: true, data }
  }
}
