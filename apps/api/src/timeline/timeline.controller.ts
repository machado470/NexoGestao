import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TimelineService } from './timeline.service'
import { Org } from '../auth/decorators/org.decorator'

@Controller('timeline')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get()
  async listByOrg(@Org() orgId: string) {
    return this.timeline.listByOrg(orgId)
  }
}
