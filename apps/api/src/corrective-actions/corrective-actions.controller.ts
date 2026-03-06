import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Org } from '../auth/decorators/org.decorator'
import { OperationalStateGuard } from '../people/operational-state.guard'
import { CorrectiveActionsService } from './corrective-actions.service'

@Controller('corrective-actions')
@UseGuards(JwtAuthGuard)
export class CorrectiveActionsController {
  constructor(
    private readonly service: CorrectiveActionsService,
  ) {}

  @Get('person/:personId')
  async listByPerson(
    @Org() orgId: string,
    @Param('personId') personId: string,
  ) {
    return this.service.listByPerson(orgId, personId)
  }

  @Post(':id/resolve')
  @UseGuards(OperationalStateGuard)
  async resolve(
    @Org() orgId: string,
    @Param('id') id: string,
  ) {
    return this.service.resolve(orgId, id)
  }

  /**
   * 🔁 FECHAMENTO AUTOMÁTICO DO REGIME
   */
  @Post('person/:personId/reassess')
  @UseGuards(OperationalStateGuard)
  async processReassessment(
    @Org() orgId: string,
    @Param('personId') personId: string,
  ) {
    return this.service.processReassessment(
      orgId,
      personId,
    )
  }
}
