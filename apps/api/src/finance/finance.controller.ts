import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'

import { OperationalStateGuard } from '../people/operational-state.guard'

import { FinanceService } from './finance.service'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { ChargesQueryDto } from './dto/charges-query.dto'
import { CreateChargeDto } from './dto/create-charge.dto'
import { UpdateChargeDto } from './dto/update-charge.dto'
import { Patch, Delete } from '@nestjs/common'

@UseGuards(JwtAuthGuard, RolesGuard, OperationalStateGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('overview')
  @Roles('ADMIN')
  async overview(@Org() orgId: string) {
    const data = await this.finance.overview(orgId)
    return { ok: true, data }
  }

  @Get('charges')
  @Roles('ADMIN')
  async listCharges(
    @Org() orgId: string,
    @Query() query: ChargesQueryDto,
  ) {
    const data = await this.finance.listCharges(orgId, query)
    return { ok: true, data } // data = { items, meta }
  }

  @Get('charges/stats')
  @Roles('ADMIN')
  async getChargeStats(@Org() orgId: string) {
    const data = await this.finance.getChargeStats(orgId)
    return { ok: true, data }
  }

  @Get('charges/revenue-by-month')
  @Roles('ADMIN')
  async getRevenueByMonth(@Org() orgId: string) {
    const data = await this.finance.getRevenueByMonth(orgId)
    return { ok: true, data }
  }

  @Get('charges/:id')
  @Roles('ADMIN')
  async getCharge(@Org() orgId: string, @Param('id') id: string) {
    const data = await this.finance.getCharge(orgId, id)
    return { ok: true, data }
  }

  @Post('charges')
  @Roles('ADMIN')
  async createCharge(
    @Org() orgId: string,
    @User() user: any,
    @Body() body: CreateChargeDto,
  ) {
    const actorUserId = user?.userId ?? user?.sub ?? null
    const actorPersonId = user?.personId ?? null

    const data = await this.finance.createCharge({
      ...body,
      orgId,
      actorUserId,
      actorPersonId,
    })
    return { ok: true, data }
  }

  @Patch('charges/:id')
  @Roles('ADMIN')
  async updateCharge(
    @Org() orgId: string,
    @User() user: any,
    @Param('id') id: string,
    @Body() body: UpdateChargeDto,
  ) {
    const actorUserId = user?.userId ?? user?.sub ?? null
    const actorPersonId = user?.personId ?? null

    const data = await this.finance.updateCharge({
      ...body,
      id,
      orgId,
      actorUserId,
      actorPersonId,
    })
    return { ok: true, data }
  }

  @Delete('charges/:id')
  @Roles('ADMIN')
  async deleteCharge(@Org() orgId: string, @Param('id') id: string) {
    await this.finance.deleteCharge(orgId, id)
    return { ok: true }
  }

  @Post('charges/:chargeId/pay')
  @Roles('ADMIN')
  async payCharge(
    @Org() orgId: string,
    @User() user: any,
    @Param('chargeId') chargeId: string,
    @Body() body: CreatePaymentDto,
  ) {
    const actorUserId = user?.userId ?? user?.sub ?? null
    const actorPersonId = user?.personId ?? null

    const data = await this.finance.payCharge({
      orgId,
      chargeId,
      actorUserId,
      actorPersonId,
      method: body.method,
      amountCents: body.amountCents,
    })

    return { ok: true, data }
  }
}
