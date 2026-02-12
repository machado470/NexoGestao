import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TimelineService } from './timeline.service'

@Controller('timeline')
@UseGuards(JwtAuthGuard)
export class TimelineController {
  constructor(
    private readonly timeline: TimelineService,
  ) {}

  @Get()
  async listGlobal() {
    return this.timeline.listGlobal()
  }
}
