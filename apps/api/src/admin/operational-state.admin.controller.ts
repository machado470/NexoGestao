import { Controller, Post, UseGuards } from '@nestjs/common'
import { OperationalStateJob } from '../people/operational-state.job'

import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'

@Controller('admin/operational-state')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class OperationalStateAdminController {
  constructor(private readonly job: OperationalStateJob) {}

  @Post('run-once')
  async runOnce() {
    await this.job.run()
    return { ok: true }
  }
}
