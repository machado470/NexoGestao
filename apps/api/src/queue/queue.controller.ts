import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { QueueService } from './queue.service'

@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Roles('ADMIN')
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('status')
  async status() {
    // Queue counts describe the entire platform, not the authenticated tenant.
    // Match the existing /internal/operations/queues boundary until a platform
    // operator authority and dedicated surface exist.
    void this.queueService
    throw new ForbiddenException('Telemetria global da plataforma não está disponível para usuários de organização.')
  }
}
