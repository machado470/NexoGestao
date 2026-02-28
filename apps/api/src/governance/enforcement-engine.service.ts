import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { RiskService } from '../risk/risk.service'
import { GovernanceRunService } from './governance-run.service'
import { EnforcementPolicyService } from './enforcement-policy.service'
import type { OperationalStateValue } from '@prisma/client'

@Injectable()
export class EnforcementEngineService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(EnforcementPolicyService)
    private readonly policy: EnforcementPolicyService,

    @Inject(TimelineService)
    private readonly timeline: TimelineService,

    @Inject(GovernanceRunService)
    private readonly run: GovernanceRunService,

    @Inject(RiskService)
    private readonly risk: RiskService,
  ) {}

  async runForOrg(orgId: string) {
    const people = await this.prisma.person.findMany({
      where: { orgId, active: true },
      select: {
        id: true,
        orgId: true,
        operationalState: true,
        operationalRiskScore: true,
      },
    })

    for (const p of people) {
      this.run.personEvaluated()

      // ✅ risco canônico que alimenta policy
      const riskScore = await this.risk.recalculatePersonRisk(
        p.id,
        'ENFORCEMENT_ENGINE',
      )

      // ✅ exceções (por enquanto false)
      const hasActiveException = await this.hasActiveException(p.id)

      const decision = this.policy.decide({
        riskScore,
        status: p.operationalState as unknown,
        hasActiveException,
        orgId: p.orgId,
        personId: p.id,
        source: 'ENFORCEMENT_ENGINE',
      })

      // ✅ contabiliza pro GovernanceRun
      this.run.recordOperationalStatus({
        state: decision.nextState as any,
        riskScore,
      })

      if (decision.action === 'NONE') continue

      if (decision.action === 'RAISE_WARNING') {
        this.run.warningRaised()

        await this.timeline.log({
          orgId: p.orgId,
          action: 'OPERATIONAL_WARNING_RAISED',
          personId: p.id,
          description: decision.reason,
          metadata: {
            actorType: 'SYSTEM',
            actor: 'ENFORCEMENT_ENGINE',
            riskScore,
            nextState: decision.nextState,
            hasActiveException,
          },
        })

        // ✅ aplica estado se mudou
        await this.setPersonStateIfChanged({
          personId: p.id,
          nextState: decision.nextState as any,
          riskScore,
        })

        continue
      }

      if (decision.action === 'CREATE_CORRECTIVE_ACTION') {
        this.run.correctiveCreated()

        await this.ensureCorrectiveAction({
          personId: p.id,
          reason: decision.reason,
          riskScore,
          nextState: decision.nextState as any,
        })

        await this.setPersonStateIfChanged({
          personId: p.id,
          nextState: decision.nextState as any,
          riskScore,
        })

        await this.timeline.log({
          orgId: p.orgId,
          action: 'OPERATIONAL_STATE_ENFORCED',
          personId: p.id,
          description: decision.reason,
          metadata: {
            actorType: 'SYSTEM',
            actor: 'ENFORCEMENT_ENGINE',
            riskScore,
            nextState: decision.nextState,
            hasActiveException,
          },
        })

        continue
      }
    }
  }

  private async setPersonStateIfChanged(params: {
    personId: string
    nextState: OperationalStateValue
    riskScore: number
  }) {
    const current = await this.prisma.person.findUnique({
      where: { id: params.personId },
      select: { operationalState: true, operationalRiskScore: true },
    })

    if (!current) return

    const stateChanged = current.operationalState !== params.nextState
    const scoreChanged = (current.operationalRiskScore ?? 0) !== params.riskScore

    if (!stateChanged && !scoreChanged) return

    await this.prisma.person.update({
      where: { id: params.personId },
      data: {
        operationalState: params.nextState as any,
        operationalRiskScore: params.riskScore,
      },
    })
  }

  private async hasActiveException(personId: string): Promise<boolean> {
    void personId
    return false
  }

  private async ensureCorrectiveAction(params: {
    personId: string
    reason: string
    riskScore: number
    nextState: any
  }) {
    const open = await this.prisma.correctiveAction.findFirst({
      where: {
        status: 'OPEN',
        personId: params.personId,
      },
      select: { id: true },
    })

    if (open) return

    await this.prisma.correctiveAction.create({
      data: {
        personId: params.personId,
        status: 'OPEN',
        reason: params.reason,
        metadata: {
          riskScore: params.riskScore,
          nextState: params.nextState,
          source: 'ENFORCEMENT_ENGINE',
        },
      } as any,
    })
  }
}
