import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'

@Injectable()
export class GovernanceRunService {
  private evaluated = 0
  private warnings = 0
  private correctives = 0
  private startedAt = new Date()

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(TimelineService)
    private readonly timeline: TimelineService,
  ) {}

  personEvaluated() {
    this.evaluated++
  }

  warningRaised() {
    this.warnings++
  }

  correctiveCreated() {
    this.correctives++
  }

  async finish() {
    const finishedAt = new Date()

    // ✅ snapshot consultável (estado)
    await this.prisma.governanceRun.create({
      data: {
        evaluated: this.evaluated,
        warnings: this.warnings,
        correctives: this.correctives,
        startedAt: this.startedAt,
        finishedAt,
      },
    })

    // ✅ trilha (história)
    await this.timeline.log({
      action: 'GOVERNANCE_RUN_COMPLETED',
      description: 'Ciclo de governança executado',
      metadata: {
        evaluated: this.evaluated,
        warnings: this.warnings,
        correctives: this.correctives,
        startedAt: this.startedAt,
        finishedAt,
      },
    })
  }
}
