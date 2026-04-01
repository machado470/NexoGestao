import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { RiskExplainabilityService } from './risk-explainability.service'

@Controller('risk/explain')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RiskExplainabilityController {
  constructor(private readonly riskExplainability: RiskExplainabilityService) {}

  @Get('person/:personId')
  @Roles('ADMIN', 'MANAGER')
  async explainPersonRisk(
    @Org() orgId: string,
    @Param('personId') personId: string,
  ) {
    const explanation = await this.riskExplainability.explainPersonRisk(orgId, personId)

    if (!explanation) {
      throw new NotFoundException('Pessoa não encontrada')
    }

    return {
      ok: true,
      data: explanation,
    }
  }
}
