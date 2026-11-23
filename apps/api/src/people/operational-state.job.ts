import {
  Injectable,
  Inject,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { RiskService } from '../risk/risk.service'
import { OperationalStateRepository } from './operational-state.repository'
import type {
  OperationalStateValue,
} from './operational-state.service'
import {
  persistOperationalStateTransition,
} from './operational-state.transition'
import {
  deriveOperationalStateFromRiskScore,
} from '../common/domain/operational-state-policy'

/** Explicit organization scope of a manual run; its orgId comes only from the authenticated session. */
export type OperationalStateRunScope = { orgId: string }
export type OperationalStateRunResult = { evaluated: number; changed: number }

@Injectable()
export class OperationalStateJob {
  constructor(
    @Inject(PrismaService)
    private readonly prisma:
      PrismaService,

    @Inject(TimelineService)
    private readonly timeline:
      TimelineService,

    @Inject(RiskService)
    private readonly risk:
      RiskService,

    @Inject(OperationalStateRepository)
    private readonly repo:
      OperationalStateRepository,
  ) {}

  /**
   * Without `scope` (internal OperationalStateScheduler): every active person of every organization,
   * unchanged. With `scope` (C8 PR3-3B-7, manual HTTP run): only the active people of that
   * organization, filtered explicitly in every query instead of relying on the tenant middleware.
   */
  async run(scope?: OperationalStateRunScope): Promise<OperationalStateRunResult> {
    const scopedOrgId = scope ? scope.orgId : null
    if (scope && (typeof scopedOrgId !== 'string' || scopedOrgId.trim().length === 0)) {
      throw new Error('Escopo de organização inválido para o recálculo manual do estado operacional')
    }

    const persons =
      await this.prisma.person.findMany({
        where: {
          active: true,
          ...(scopedOrgId !== null ? { orgId: scopedOrgId } : {}),
        },
        select: {
          id: true,
          orgId: true,
          operationalState: true,
          operationalRiskScore: true,
          operationalStateUpdatedAt: true,
        },
      })

    let evaluated = 0
    let changed = 0

    const now = new Date()

    for (const p of persons) {
      // Defense in depth: a scoped run never touches a person of another organization.
      if (scopedOrgId !== null && p.orgId !== scopedOrgId) continue

      evaluated++

      /*
       * Calculate-only:
       * sem RiskSnapshot e sem Timeline lateral.
       */
      const riskScore =
        await this.risk
          .calculatePersonRisk(p.id, scopedOrgId ?? undefined)

      const nextState =
        deriveOperationalStateFromRiskScore(
          riskScore,
        )

      const transition =
        await persistOperationalStateTransition({
          prisma: this.prisma,
          repository: this.repo,
          timeline: this.timeline,
          snapshot: {
            id: p.id,
            orgId: p.orgId,
            operationalState: p.operationalState as OperationalStateValue,
            operationalRiskScore:
              p.operationalRiskScore,
            operationalStateUpdatedAt:
              p.operationalStateUpdatedAt,
          },
          nextState,
          riskScore,
          source:
            'OPERATIONAL_STATE_JOB',
          reason:
            'Risco operacional calculado para pessoa ativa',
          evaluatedRecords: 1,
          evaluatedAt: now,
        })

      /*
       * Mantém a semântica histórica do Job:
       * snapshot reparado/atualizado conta como
       * mudança processada mesmo se a Timeline
       * já continha o estado autoritativo.
       */
      if (transition.claimed) {
        changed++
      }
    }

    console.log(
      `[OperationalStateJob] scope=${scopedOrgId !== null ? 'organization' : 'global'} evaluated=${evaluated} changed=${changed} at=${new Date().toISOString()}`,
    )

    return { evaluated, changed }
  }
}
