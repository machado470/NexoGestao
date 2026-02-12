import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { GovernanceReadService } from './governance-read.service'

@Controller('governance')
@UseGuards(JwtAuthGuard)
export class GovernanceReadController {
  constructor(
    private readonly read: GovernanceReadService,
  ) {}

  @Get('summary')
  async summary() {
    return this.read.getSummary()
  }

  @Get('runs')
  async runs(
    @Query('limit') limit?: string,
  ) {
    return this.read.listRuns(
      limit ? Number(limit) : 20,
    )
  }

  @Get('runs/latest')
  async latest() {
    return this.read.getLatestRun()
  }
}
