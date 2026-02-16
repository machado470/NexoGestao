import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { EnforcementPolicyService } from './enforcement-policy.service'
import { OperationalStateService } from '../people/operational-state.service'
import { TimelineService } from '../timeline/timeline.service'
import { GovernanceRunService } from './governance-run.service'
import { RiskService } from '../risk/risk.service'

@Injectable()
export class EnforcementEngineService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(EnforcementPolicyService)
    private readonly policy: EnforcementPolicyService,

    @Inject(OperationalStateService)
    private readonly operationalState: OperationalStateService,

    @Inject(TimelineService)
    private readonly timeline: TimelineService,

    @Inject(GovernanceRunService)
    private readonly run: GovernanceRunService,

    @Inject(RiskService)
    private readonly risk: RiskService,
  ) {}

  async runForOrg(orgId: string) {
    const persons = await this.prisma.person.findMany({
      where: { active: true, orgId },
      select: { id: true },
    })

    for (const p of persons) {
      await this.runForPerson(orgId, p.id)
    }

    return { evaluated: persons.length }
  }

  private async runForPerson(orgId: string, personId: string) {
    this.run.personEvaluated()

    const sync = await this.operationalState.syncAndLogStateChange(
      orgId,
      personId,
    )

    const status = sync.status

    this.run.recordOperationalStatus({
      state: status.state,
      riskScore: status.riskScore,
    })

    const hasActiveException =
      (await this.prisma.personException.count({
        where: { personId, processedAt: null },
      })) > 0

    const decision = this.policy.decide({
      status,
      hasActiveException,
    })

    if (decision.action === 'NONE') return

    if (decision.action === 'RAISE_WARNING') {
      const enteredWarning = sync.changed && sync.to === 'WARNING'
      if (!enteredWarning) return

      this.run.warningRaised()

      await this.timeline.log({
        orgId,
        action: 'OPERATIONAL_WARNING_RAISED',
        personId,
        description: decision.reason,
        metadata: {
          state: status.state,
          riskScore: status.riskScore,
          from: sync.from,
          to: sync.to,
        },
      })

      return
    }

    if (decision.action === 'CREATE_CORRECTIVE_ACTION') {
      const exists = await this.prisma.correctiveAction.findFirst({
        where: {
          personId,
          status: 'OPEN',
          reason: decision.reason,
        },
      })

      if (exists) return

      await this.prisma.correctiveAction.create({
        data: {
          personId,
          reason: decision.reason,
          status: 'OPEN',
        },
      })

      this.run.correctiveCreated()

      await this.timeline.log({
        orgId,
        action: 'CORRECTIVE_ACTION_CREATED',
        personId,
        description: decision.reason,
        metadata: {
          state: status.state,
          riskScore: status.riskScore,
        },
      })

      await this.risk.recalculatePersonRisk(personId, 'CORRECTIVE_CREATED')
    }
  }
}
