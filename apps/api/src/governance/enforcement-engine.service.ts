import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { EnforcementPolicyService } from './enforcement-policy.service'
import { OperationalStateValue } from '@prisma/client'
import { OperationalStateRepository } from '../people/operational-state.repository'
import { persistOperationalStateTransition } from '../people/operational-state.transition'
import { TemporalRiskService } from '../risk/temporal-risk.service'

export type EnforcementRunResult = {
  evaluated: number
  warnings: number
  correctivesCreated: number
  restrictedCount: number
  suspendedCount: number
}

@Injectable()
export class EnforcementEngineService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(EnforcementPolicyService)
    private readonly policy: EnforcementPolicyService,

    @Inject(TimelineService)
    private readonly timeline: TimelineService,

    @Inject(OperationalStateRepository)
    private readonly operationalStateRepository: OperationalStateRepository,

    // Canonical live risk (same calculation the OperationalStateGuard uses through getStatus).
    @Inject(TemporalRiskService)
    private readonly temporalRisk: TemporalRiskService,
  ) {}

  /**
   * Engine NÃO gerencia GovernanceRunService pra evitar dependência circular.
   * Ele só executa e devolve um resumo; Controller/Job cuidam do runService.
   */
  async runForOrg(orgId: string): Promise<EnforcementRunResult> {
    const result: EnforcementRunResult = {
      evaluated: 0,
      warnings: 0,
      correctivesCreated: 0,
      restrictedCount: 0,
      suspendedCount: 0,
    }

    const people = await this.prisma.person.findMany({
      where: { orgId, active: true },
      select: {
        id: true,
        orgId: true,
        operationalState: true,
        operationalRiskScore: true,
        operationalStateUpdatedAt: true,
      },
    })

    for (const p of people) {
      result.evaluated++

      // Fonte canônica (por enquanto): score já persistido no Person
      const persistedRiskScore = Number(p.operationalRiskScore ?? 0)
      const currentState = (p.operationalState ?? OperationalStateValue.NORMAL) as any

      // exceções (por enquanto via tabela PersonException)
      const hasActiveException = await this.hasActiveException(p.id)

      let riskScore = persistedRiskScore
      let decision = this.policy.decide({
        riskScore,
        status: currentState,
        hasActiveException,
        orgId: p.orgId,
        personId: p.id,
        source: 'ENFORCEMENT_ENGINE',
      })

      // C8 PR3-3B-4 (A): a corrective action is never created from the persisted score alone. The
      // persisted score can be stale (e.g. a corrective action was closed and the recalculation
      // failed after the commit). Re-evaluate with the live risk, same calculation and thresholds
      // as the OperationalStateGuard, right before acting; if it no longer justifies RESTRICTED or
      // SUSPENDED, do nothing here (the operational-state reconciliation job repairs the score).
      if (decision.action === 'CREATE_CORRECTIVE_ACTION') {
        const liveRiskScore = await this.temporalRisk.calculate(p.id, p.orgId)
        const liveDecision = this.policy.decide({
          riskScore: liveRiskScore,
          status: currentState,
          hasActiveException,
          orgId: p.orgId,
          personId: p.id,
          source: 'ENFORCEMENT_ENGINE',
        })
        if (liveDecision.action !== 'CREATE_CORRECTIVE_ACTION') continue
        riskScore = liveRiskScore
        decision = liveDecision
      }

      // contagem do “estado alvo” (pós decisão)
      if (decision.nextState === 'RESTRICTED') result.restrictedCount++
      if (decision.nextState === 'SUSPENDED') result.suspendedCount++

      if (decision.action === 'NONE') continue

      if (decision.action === 'RAISE_WARNING') {
        result.warnings++

        const warningMetadata = {
          actorType: 'SYSTEM',
          actor: 'ENFORCEMENT_ENGINE',
          riskScore,
          previousState: p.operationalState ?? null,
          nextState: decision.nextState,
          reason: decision.reason,
          result: decision.action,
          severity: 'WARNING',
          hasActiveException,
        }

        const transitioned = await this.persistPersonStateTransition({
          orgId: p.orgId,
          personId: p.id,
          expectedState: p.operationalState ?? null,
          expectedRiskScore: persistedRiskScore,
          nextRiskScore: riskScore,
          expectedUpdatedAt: p.operationalStateUpdatedAt,
          nextState: decision.nextState as any,
          description: decision.reason,
          metadata: warningMetadata,
        })

        // C8 PR3-3B-4 (B): emitted only for a transition confirmed by the CAS, never on every
        // periodic run. These events count as OPERATIONAL_STATE_CHANGED in the risk calculation, so
        // repeating them fed the score back (up to +20) and kept people in WARNING or above.
        if (transitioned) {
          await this.timeline.log({
            orgId: p.orgId,
            action: 'OPERATIONAL_WARNING_RAISED',
            personId: p.id,
            description: decision.reason,
            metadata: warningMetadata,
          })
        }

        continue
      }

      if (decision.action === 'CREATE_CORRECTIVE_ACTION') {
        const created = await this.ensureCorrectiveAction({
          personId: p.id,
          reason: decision.reason,
          riskScore,
          nextState: decision.nextState as any,
        })

        if (created) result.correctivesCreated++

        const enforcedMetadata = {
          actorType: 'SYSTEM',
          actor: 'ENFORCEMENT_ENGINE',
          riskScore,
          previousState: p.operationalState ?? null,
          nextState: decision.nextState,
          reason: decision.reason,
          result: decision.action,
          severity: 'CRITICAL',
          hasActiveException,
          correctiveCreated: created,
        }

        const transitioned = await this.persistPersonStateTransition({
          orgId: p.orgId,
          personId: p.id,
          expectedState: p.operationalState ?? null,
          expectedRiskScore: persistedRiskScore,
          nextRiskScore: riskScore,
          expectedUpdatedAt: p.operationalStateUpdatedAt,
          nextState: decision.nextState as any,
          description: decision.reason,
          metadata: enforcedMetadata,
        })

        // C8 PR3-3B-4 (B): only when something actually happened in this run: a new corrective
        // action was created, or the state transition was confirmed by the CAS.
        if (created || transitioned) {
          await this.timeline.log({
            orgId: p.orgId,
            action: 'OPERATIONAL_STATE_ENFORCED',
            personId: p.id,
            description: decision.reason,
            metadata: enforcedMetadata,
          })
        }
      }
    }

    return result
  }

  private async persistPersonStateTransition(params: {
    orgId: string
    personId: string
    expectedState: OperationalStateValue | null
    expectedRiskScore: number
    /** Score written with the transition (the live score when it was re-evaluated). */
    nextRiskScore?: number
    expectedUpdatedAt: Date | null
    nextState: OperationalStateValue
    description: string
    metadata: Record<string, unknown>
  }): Promise<boolean> {
    if (params.expectedState === params.nextState) {
      return false
    }

    const result = await persistOperationalStateTransition({
      prisma: this.prisma,
      repository: this.operationalStateRepository,
      timeline: this.timeline,
      snapshot: {
        id: params.personId,
        orgId: params.orgId,
        operationalState: params.expectedState
          ?? OperationalStateValue.NORMAL,
        operationalRiskScore: params.expectedRiskScore,
        operationalStateUpdatedAt: params.expectedUpdatedAt,
      },
      nextState: params.nextState,
      riskScore: params.nextRiskScore ?? params.expectedRiskScore,
      source: 'ENFORCEMENT_ENGINE',
      reason: params.description,
      metadata: params.metadata,
    })

    return result.changed
  }

  private async hasActiveException(personId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ active: boolean }>>`
      select exists (
        select 1
        from "PersonException" pe
        where pe."personId" = ${personId}
          and now() between pe."startsAt" and pe."endsAt"
      ) as active
    `
    return Boolean(rows?.[0]?.active)
  }

  private async ensureCorrectiveAction(params: {
    personId: string
    reason: string
    riskScore: number
    nextState: OperationalStateValue
  }): Promise<boolean> {
    const active = await this.prisma.correctiveAction.findFirst({
      where: {
        personId: params.personId,
        status: { in: ['OPEN', 'AWAITING_REASSESSMENT'] },
      },
      select: { id: true },
    })

    if (active) return false

    await this.prisma.correctiveAction.create({
      data: {
        personId: params.personId,
        status: 'OPEN',
        reason: params.reason,
      },
    })

    return true
  }
}
