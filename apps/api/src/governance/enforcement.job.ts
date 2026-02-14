import { Injectable, Inject } from '@nestjs/common'
import { EnforcementEngineService } from './enforcement-engine.service'
import { GovernanceRunService } from './governance-run.service'

@Injectable()
export class EnforcementJob {
  constructor(
    @Inject(EnforcementEngineService)
    private readonly engine: EnforcementEngineService,

    @Inject(GovernanceRunService)
    private readonly runService: GovernanceRunService,
  ) {}

  async run() {
    this.runService.startRun()

    await this.engine.runForAllActivePeople()

    return this.runService.finish()
  }
}
