import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { EnforcementPolicyService } from './enforcement-policy.service'
import { OperationalStateService } from '../people/operational-state.service'
import { TimelineService } from '../timeline/timeline.service'
import { GovernanceRunService } from './governance-run.service'

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
  ) {}

  async runForAllActivePeople() {
    const persons = await this.prisma.person.findMany({
      where: { active: true },
      select: { id: true },
    })

    for (const p of persons) {
      await this.runForPerson(p.id)
    }
  }

  private async runForPerson(personId: string) {
    this.run.personEvaluated()

    const status = await this.operationalState.getStatus(personId)

    // ✅ exceção ativa = existe registro ainda não processado
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
      this.run.warningRaised()

      await this.timeline.log({
        action: 'OPERATIONAL_WARNING_RAISED',
        personId,
        description: decision.reason,
        metadata: {
          state: status.state,
          riskScore: status.riskScore,
        },
      })
    }

    if (decision.action === 'CREATE_CORRECTIVE_ACTION') {
      const exists = await this.prisma.correctiveAction.findFirst({
        where: {
          personId,
          status: 'OPEN',
          reason: decision.reason,
        },
      })

      if (!exists) {
        await this.prisma.correctiveAction.create({
          data: {
            personId,
            reason: decision.reason,
            status: 'OPEN',
          },
        })

        this.run.correctiveCreated()

        await this.timeline.log({
          action: 'CORRECTIVE_ACTION_CREATED',
          personId,
          description: decision.reason,
          metadata: {
            state: status.state,
            riskScore: status.riskScore,
          },
        })
      }
    }
  }
}
