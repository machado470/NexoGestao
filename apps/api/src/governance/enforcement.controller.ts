import { Controller, Post, UseGuards, ForbiddenException } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { EnforcementJob } from './enforcement.job'

@Controller('admin/enforcement')
@UseGuards(JwtAuthGuard)
export class EnforcementController {
  constructor(private readonly job: EnforcementJob) {}

  /**
   * Roda enforcement manualmente.
   * ✅ Permitido apenas em DEV (ou quando explicitamente habilitado).
   */
  @Post('run-once')
  async runOnce() {
    const allow =
      process.env.NODE_ENV !== 'production' ||
      process.env.ALLOW_MANUAL_ENFORCEMENT === 'true'

    if (!allow) {
      throw new ForbiddenException('Manual enforcement desabilitado.')
    }

    return this.job.run()
  }
}
