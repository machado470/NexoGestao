import { Controller, Get, Query, UseGuards } from '@nestjs/common'
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
}
