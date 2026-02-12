import { Injectable } from '@nestjs/common'
import { OperationalStateJob } from './operational-state.job'

@Injectable()
export class OperationalStateRunner {
  constructor(
    private readonly job: OperationalStateJob,
  ) {}

  async runOnce() {
    await this.job.run()
    return { success: true }
  }
}
