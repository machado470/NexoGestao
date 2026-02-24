import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { FinanceService } from './finance.service'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { ChargesQueryDto } from './dto/charges-query.dto'

@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('overview')
  async overview(@Req() req: any) {
    const orgId = req.user.orgId
    const data = await this.finance.overview(orgId)
    return { ok: true, data }
  }

  @Get('charges')
  async listCharges(@Req() req: any, @Query() query: ChargesQueryDto) {
    const orgId = req.user.orgId
    const data = await this.finance.listCharges(orgId, query)
    return { ok: true, data }
  }

  @Get('charges/:id')
  async getCharge(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user.orgId
    const data = await this.finance.getCharge(orgId, id)
    return { ok: true, data }
  }

  @Post('charges/:chargeId/pay')
  async payCharge(
    @Req() req: any,
    @Param('chargeId') chargeId: string,
    @Body() body: CreatePaymentDto,
  ) {
    const orgId = req.user.orgId
    const actorUserId = req.user.sub
    const actorPersonId = req.user.personId

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
