import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'
import { ExecutionService } from './execution.service'
import { Throttle } from '@nestjs/throttler'

@Controller('executions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExecutionController {
  constructor(private readonly execution: ExecutionService) {}

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
}
