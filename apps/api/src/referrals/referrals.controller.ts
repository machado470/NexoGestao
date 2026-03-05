import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { ReferralsService } from './referrals.service'
import { CreateReferralDto, ReferralStatus } from './dto/create-referral.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  @Roles('ADMIN')
  async list(
    @Org() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: ReferralStatus,
    @Query('q') q?: string,
  ) {
    return this.referrals.list(orgId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      q,
    })
  }

  @Get('summary')
  @Roles('ADMIN')
  async summary(@Org() orgId: string) {
    return this.referrals.summary(orgId)
  }

  @Get('stats')
  @Roles('ADMIN')
  async stats(
    @Org() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.referrals.stats(orgId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 100,
    })
  }

  @Get('balance')
  @Roles('ADMIN')
  async getBalance(@Org() orgId: string) {
    return this.referrals.getBalance(orgId)
  }

  @Post()
  @Roles('ADMIN')
  async create(@Org() orgId: string, @Body() body: CreateReferralDto) {
    return this.referrals.create(orgId, body)
  }

  @Post('generate-code')
  @Roles('ADMIN')
  async generateCode(@Org() orgId: string) {
    return this.referrals.generateCode(orgId)
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(
    @Org() orgId: string,
    @Param('id') id: string,
    @Body() body: { status?: ReferralStatus; creditAmount?: number },
  ) {
    return this.referrals.update(orgId, id, body)
  }

  @Delete(':id')
  @Roles('ADMIN')
  async delete(@Org() orgId: string, @Param('id') id: string) {
    return this.referrals.delete(orgId, id)
  }
}
