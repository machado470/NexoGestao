import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Org } from '../auth/decorators/org.decorator'
import { PeopleOverviewService } from './people-overview.service'

@Controller('people')
@UseGuards(JwtAuthGuard)
export class PeopleOverviewController {
  constructor(
    private readonly overview: PeopleOverviewService,
  ) {}

  /**
   * 👑 VISÃO ADMIN — FONTE ÚNICA DE VERDADE
   */
  @Get(':id/overview')
  async getOverview(@Org() orgId: string, @Param('id') id: string) {
    return this.overview.getOverview(orgId, id)
  }
}
