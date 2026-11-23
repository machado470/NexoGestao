import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { OperationalStateGuard } from '../people/operational-state.guard'
import { CorrectiveActionsService, type CorrectiveActionActor } from './corrective-actions.service'

/** Who closes the action, taken only from the validated session (never from the body or headers). */
function actorOf(req: any): CorrectiveActionActor {
  const user = req?.user ?? {}
  const userId = user.userId ?? user.sub
  return {
    userId: typeof userId === 'string' && userId ? userId : null,
    personId: typeof user.personId === 'string' && user.personId ? user.personId : null,
  }
}

// C8 PR3-3B-2: only organization ADMINs close corrective actions, never their own. JwtAuthGuard
// must run first so RolesGuard sees req.user; the GET keeps its current access (privacy: PR3-5).
@Controller('corrective-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles('ADMIN')
  @UseGuards(OperationalStateGuard)
  async resolve(
    @Req() req: any,
    @Org() orgId: string,
    @Param('id') id: string,
  ) {
    return this.service.resolve(orgId, id, actorOf(req))
  }

  /**
   * 🔁 FECHAMENTO AUTOMÁTICO DO REGIME
   */
  @Post('person/:personId/reassess')
  @Roles('ADMIN')
  @UseGuards(OperationalStateGuard)
  async processReassessment(
    @Req() req: any,
    @Org() orgId: string,
    @Param('personId') personId: string,
  ) {
    return this.service.processReassessment(
      orgId,
      personId,
      actorOf(req),
    )
  }
}
