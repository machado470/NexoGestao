import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { OperationalStateGuard } from '../people/operational-state.guard'
import { AssessmentsService, type AssessmentActor } from './assessments.service'

/** Author of the submission, taken only from the validated session (never from the body or headers). */
function actorOf(req: any): AssessmentActor {
  const user = req?.user ?? {}
  const userId = user.userId ?? user.sub
  return {
    userId: typeof userId === 'string' && userId ? userId : null,
    personId: typeof user.personId === 'string' && user.personId ? user.personId : null,
  }
}

// C8 PR3-3A: only organization ADMINs submit assessments, never for their own assignment.
// JwtAuthGuard must run first so RolesGuard sees req.user; OperationalStateGuard is kept as is.
@Controller('assessments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentsController {
  constructor(
    private readonly service: AssessmentsService,
  ) {}

  /**
   * 📝 SUBMISSÃO DE AVALIAÇÃO — AÇÃO HUMANA
   */
  @Post()
  @Roles('ADMIN')
  @UseGuards(OperationalStateGuard)
  async submit(
    @Req() req: any,
    @Org() orgId: string,
    @Body()
    body: {
      assignmentId: string
      score: number
    },
  ) {
    // Only the two business fields are read from the body: identity, role and organization come
    // from the session, so client-supplied personId/actor/role/orgId fields are ignored.
    return this.service.submit({
      assignmentId: body?.assignmentId,
      score: body?.score,
      orgId,
      actor: actorOf(req),
    })
  }
}
