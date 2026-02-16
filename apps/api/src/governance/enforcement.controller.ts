import {
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { EnforcementEngineService } from './enforcement-engine.service'
import { GovernanceRunService } from './governance-run.service'

@Controller('admin/enforcement')
@UseGuards(JwtAuthGuard)
export class EnforcementController {
  constructor(
    private readonly engine: EnforcementEngineService,
    private readonly runService: GovernanceRunService,
  ) {}

  @Post('run-once')
  async runOnce(@Req() req: any) {
    const enabled = process.env.ALLOW_MANUAL_ENFORCEMENT === '1'
    if (!enabled) {
      throw new ForbiddenException('Manual enforcement desabilitado.')
    }

    const orgId = req.user.orgId

    // ✅ Orquestra igual o job, mas só pra org atual
    this.runService.startRun(orgId)
    const engineResult = await this.engine.runForOrg(orgId)
    const runSummary = await this.runService.finish(orgId)

    return {
      ok: true,
      data: {
        engine: engineResult,
        run: runSummary,
      },
    }
  }
}
