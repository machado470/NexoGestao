import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import type { OperationalStateValue } from '../people/operational-state.service'

@Injectable()
export class GovernanceRunService {
  private evaluated = 0
  private warnings = 0
  private correctives = 0

  private riskSum = 0
  private restrictedCount = 0
  private suspendedCount = 0

  private startedAt: Date = new Date()

  private currentOrgId: string | null = null

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(TimelineService)
    private readonly timeline: TimelineService,
  ) {}

  startRun(orgId: string) {
    this.currentOrgId = orgId

    this.evaluated = 0
    this.warnings = 0
    this.correctives = 0

    this.riskSum = 0
    this.restrictedCount = 0
    this.suspendedCount = 0

    this.startedAt = new Date()
  }

  personEvaluated() {
    this.evaluated++
  }

  warningRaised() {
    this.warnings++
  }

  correctiveCreated() {
    this.correctives++
  }

  recordOperationalStatus(params: { state: OperationalStateValue; riskScore: number }) {
    this.riskSum += params.riskScore
    if (params.state === 'RESTRICTED') this.restrictedCount++
    if (params.state === 'SUSPENDED') this.suspendedCount++
  }

  async finish(orgId?: string) {
    const resolvedOrgId = orgId ?? this.currentOrgId
    if (!resolvedOrgId) {
      throw new Error('GovernanceRunService.finish(): orgId não informado')
    }

    const finishedAt = new Date()
    const durationMs = Math.max(0, finishedAt.getTime() - this.startedAt.getTime())

    const institutionalRiskScore =
      this.evaluated === 0 ? 0 : Math.min(100, Math.round(this.riskSum / this.evaluated))

    const openCorrectivesCount = await this.prisma.correctiveAction.count({
      where: {
        status: 'OPEN',
        person: { orgId: resolvedOrgId },
      },
    })

    await this.prisma.governanceRun.create({
      data: {
        orgId: resolvedOrgId,

        evaluated: this.evaluated,
        warnings: this.warnings,
        correctives: this.correctives,

        institutionalRiskScore,
        restrictedCount: this.restrictedCount,
        suspendedCount: this.suspendedCount,
        openCorrectivesCount,

        durationMs,
        startedAt: this.startedAt,
        finishedAt,
      },
    })

    await this.timeline.log({
      orgId: resolvedOrgId,
      action: 'GOVERNANCE_RUN_COMPLETED',
      description: 'Ciclo de governança executado',
      metadata: {
        actorType: 'SYSTEM',
        actor: 'GOVERNANCE_RUN',

        orgId: resolvedOrgId,

        evaluated: this.evaluated,
        warnings: this.warnings,
        correctives: this.correctives,

        institutionalRiskScore,
        restrictedCount: this.restrictedCount,
        suspendedCount: this.suspendedCount,
        openCorrectivesCount,

        durationMs,
        startedAt: this.startedAt,
        finishedAt,
      },
    })

    return {
      orgId: resolvedOrgId,
      evaluated: this.evaluated,
      warnings: this.warnings,
      correctives: this.correctives,
      institutionalRiskScore,
      restrictedCount: this.restrictedCount,
      suspendedCount: this.suspendedCount,
      openCorrectivesCount,
      durationMs,
      startedAt: this.startedAt,
      finishedAt,
    }
  }

  // ✅ NOVO: permite o GovernanceRunJob fechar um run por agregados (sem depender do engine)
  async finishWithAggregates(params: {
    orgId: string
    evaluated: number
    warnings: number
    correctives: number
    institutionalRiskScore: number
    restrictedCount: number
    suspendedCount: number
    openCorrectivesCount: number
  }) {
    // se ninguém chamou startRun, ainda assim dá pra finalizar coerente
    const startedAt = this.currentOrgId === params.orgId ? this.startedAt : new Date()
    const finishedAt = new Date()
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime())

    await this.prisma.governanceRun.create({
      data: {
        orgId: params.orgId,

        evaluated: params.evaluated,
        warnings: params.warnings,
        correctives: params.correctives,

        institutionalRiskScore: params.institutionalRiskScore,
        restrictedCount: params.restrictedCount,
        suspendedCount: params.suspendedCount,
        openCorrectivesCount: params.openCorrectivesCount,

        durationMs,
        startedAt,
        finishedAt,
      },
    })

    await this.timeline.log({
      orgId: params.orgId,
      action: 'GOVERNANCE_RUN_COMPLETED',
      description: 'Ciclo de governança executado',
      metadata: {
        actorType: 'SYSTEM',
        actor: 'GOVERNANCE_RUN',
        ...params,
        durationMs,
        startedAt,
        finishedAt,
        source: 'GOVERNANCE_RUN_JOB',
      },
    })

    return {
      ...params,
      durationMs,
      startedAt,
      finishedAt,
    }
  }
}
