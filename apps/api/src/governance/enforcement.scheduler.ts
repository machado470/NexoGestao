import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { EnforcementJob } from './enforcement.job'

@Injectable()
export class EnforcementScheduler {
  constructor(private readonly job: EnforcementJob) {}

  // a cada 5 minutos
  @Cron('*/5 * * * *')
  async tick() {
    // em produção você liga; em dev você pode desligar
    if (process.env.DISABLE_GOVERNANCE_SCHEDULE === 'true') return
    await this.job.run()
  }
}
