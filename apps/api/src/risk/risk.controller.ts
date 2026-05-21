import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Org } from '../auth/decorators/org.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RiskService } from './risk.service'

@Controller('risk')
@UseGuards(JwtAuthGuard)
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  @Get('people/:personId')
  async getPersonRisk(
    @Org() orgId: string,
    @Param('personId') personId: string,
  ) {
    return this.risk.getPersonRiskExplanation(personId, orgId)
  }

  @Get('customers/:customerId')
  async getCustomerRisk(
    @Req() req: any,
    @Param('customerId') customerId: string,
  ) {
    return this.risk.getCustomerOperationalRisk(
      req.user.orgId,
      customerId,
    )
  }
}
