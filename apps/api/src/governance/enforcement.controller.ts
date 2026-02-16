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

function envBool(name: string, fallback = false): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false
  return fallback
}

@Controller('admin/enforcement')
@UseGuards(JwtAuthGuard)
export class EnforcementController {
  constructor(
    private readonly engine: EnforcementEngineService,
    private readonly runService: GovernanceRunService,
  ) {}

  @Post('run-once')
  async runOnce(@Req() req: any) {
    const enabled = envBool('ALLOW_MANUAL_ENFORCEMENT', false)
    if (!enabled) {
      throw new ForbiddenException('Manual enforcement desabilitado.')
    }

    const orgId = req.user.orgId

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
