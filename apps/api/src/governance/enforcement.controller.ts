import {
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { PrismaService } from '../prisma/prisma.service'
import { EnforcementEngineService } from './enforcement-engine.service'
import { GovernanceRunService } from './governance-run.service'

function envBool(name: string, fallback = false): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(raw)) return false
  return fallback
}

// C8 PR3-3B-6: the manual run executes the enforcement engine (state transitions, corrective
// actions, timeline) for the caller's organization, so it is ADMIN-only. JwtAuthGuard runs first
// so RolesGuard sees the validated session; the organization comes only from that session.
@Controller('admin/enforcement')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnforcementController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    private readonly engine: EnforcementEngineService,
    private readonly runService: GovernanceRunService,
  ) {}

  @Post('run-once')
  @Roles('ADMIN')
  async runOnce(@Req() req: any) {
    const enabled = envBool('ALLOW_MANUAL_ENFORCEMENT', false)
    if (!enabled) {
      throw new ForbiddenException('Manual enforcement desabilitado.')
    }

    const orgId = req.user.orgId

    await this.runService.startRun(orgId)

    const engineResult = await this.engine.runForOrg(orgId)

    const agg = await this.prisma.person.aggregate({
      where: { orgId, active: true },
      _avg: { operationalRiskScore: true },
    })

    const institutionalRiskScore = Math.min(
      100,
      Math.max(0, Math.round(agg._avg.operationalRiskScore ?? 0)),
    )

    const openCorrectivesCount = await this.prisma.correctiveAction.count({
      where: {
        status: 'OPEN',
        person: { orgId },
      },
    })

    const runSummary = await this.runService.finishWithAggregates({
      orgId,
      evaluated: engineResult.evaluated,
      warnings: engineResult.warnings,
      correctives: engineResult.correctivesCreated,
      institutionalRiskScore,
      restrictedCount: engineResult.restrictedCount,
      suspendedCount: engineResult.suspendedCount,
      openCorrectivesCount,
    })

    return {
      ok: true,
      data: {
        engine: engineResult,
        run: runSummary,
      },
    }
  }
}
