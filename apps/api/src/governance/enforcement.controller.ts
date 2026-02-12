import { Controller, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { EnforcementJob } from './enforcement.job'

@Controller('admin/enforcement')
@UseGuards(JwtAuthGuard)
export class EnforcementController {
  constructor(private readonly job: EnforcementJob) {}

  /**
   * ⚠️ DEV/DEMO
   * Roda enforcement manualmente (1x)
   */
  @Post('run-once')
  async runOnce() {
    return this.job.run()
  }
}
