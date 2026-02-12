import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
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
  async getOverview(@Param('id') id: string) {
    return this.overview.getOverview(id)
  }
}
