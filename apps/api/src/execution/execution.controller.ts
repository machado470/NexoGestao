import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'
import { ExecutionService } from './execution.service'
import { Throttle } from '@nestjs/throttler'
import { ExecutionRunner } from './execution.runner'
import { ExecutionEventsService } from './execution.events'
import { ExecutionConfigService } from './execution.config'

@Controller('executions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExecutionController {
  constructor(
    private readonly execution: ExecutionService,
    private readonly runner: ExecutionRunner,
    private readonly events: ExecutionEventsService,
    private readonly config: ExecutionConfigService,
  ) {}

  @Get('service-order/:serviceOrderId')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'VIEWER')
  listByServiceOrder(@Org() orgId: string, @Param('serviceOrderId') serviceOrderId: string) {
    return this.execution.listByServiceOrder(orgId, serviceOrderId)
  }

  @Post('start')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  start(@Org() orgId: string, @User() user: any, @Body() body: any) {
    return this.execution.start({ orgId, serviceOrderId: body.serviceOrderId, notes: body.notes, checklist: body.checklist, attachments: body.attachments, executorPersonId: user?.personId ?? null })
  }

  @Post(':id/complete')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  complete(@Org() orgId: string, @Param('id') id: string, @Body() body: any) {
    return this.execution.complete({ orgId, executionId: id, notes: body.notes, checklist: body.checklist, attachments: body.attachments })
  }

  @Get('state-summary')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'VIEWER')
  stateSummary(@Org() orgId: string, @Query('sinceMs') sinceMs?: string) {
    const normalizedSinceMs = Number(sinceMs ?? 1000 * 60 * 60 * 24)
    return this.events.getStateSummary(orgId, Number.isFinite(normalizedSinceMs) ? normalizedSinceMs : undefined)
  }

  @Get('mode')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'VIEWER')
  mode(@Org() orgId: string) {
    return {
      mode: this.config.getExecutionMode({ orgId }),
      policy: this.config.getPolicyConfig({ orgId }),
    }
  }

  @Post('runner/run-once')
  @Roles('ADMIN', 'MANAGER')
  runOnce() {
    return this.runner.runOnce()
  }
}
