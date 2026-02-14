import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { EnforcementEngineService } from './enforcement-engine.service'
import { GovernanceRunService } from './governance-run.service'

@Injectable()
export class EnforcementJob {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,

    @Inject(EnforcementEngineService)
    private readonly engine: EnforcementEngineService,

    @Inject(GovernanceRunService)
    private readonly runService: GovernanceRunService,
  ) {}

  async run() {
    const orgs = await this.prisma.organization.findMany({
      select: { id: true },
    })

    for (const org of orgs) {
      this.runService.startRun(org.id)
      await this.engine.runForOrg(org.id)
      await this.runService.finish(org.id)
    }
  }
}
