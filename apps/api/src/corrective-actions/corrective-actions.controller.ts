import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
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
    @Param('personId') personId: string,
  ) {
    return this.service.listByPerson(personId)
  }

  @Post(':id/resolve')
  @UseGuards(OperationalStateGuard)
  async resolve(@Param('id') id: string) {
    return this.service.resolve(id)
  }

  /**
   * 🔁 FECHAMENTO AUTOMÁTICO DO REGIME
   */
  @Post('person/:personId/reassess')
  @UseGuards(OperationalStateGuard)
  async processReassessment(
    @Param('personId') personId: string,
  ) {
    return this.service.processReassessment(
      personId,
    )
  }
}
