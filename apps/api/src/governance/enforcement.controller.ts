import {
  Controller,
  ForbiddenException,
  Post,
  Req,
  UseGuards,
  Inject,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
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

@Controller('admin/enforcement')
@UseGuards(JwtAuthGuard)
export class EnforcementController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

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
