import { Controller, Post, Req, UseGuards } from '@nestjs/common'
import { OperationalStateJob } from '../people/operational-state.job'

import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { auditedManualRun, manualRunActor } from '../audit/manual-run-audit'
import { RequestContextService } from '../common/context/request-context.service'

// C8 PR3-3B-7: the manual recalculation covers only the session organization (never a global sweep)
// and every attempt reaching this handler is audited. The global run stays with the internal scheduler.
@Controller('admin/operational-state')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class OperationalStateAdminController {
  constructor(
    private readonly job: OperationalStateJob,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('run-once')
  async runOnce(@Req() req: any) {
    const actor = manualRunActor(req)
    await auditedManualRun({
      audit: this.audit,
      action: AUDIT_ACTIONS.MANUAL_OPERATIONAL_STATE_RUN,
      operation: 'admin.operational-state.run-once',
      actor,
      correlationId: this.requestContext.correlationId,
      run: () => this.job.run({ orgId: actor.orgId }),
      summarize: (result) => ({ outcome: 'SUCCEEDED', counters: { evaluated: result.evaluated, changed: result.changed } }),
    })
    return { ok: true }
  }
}
