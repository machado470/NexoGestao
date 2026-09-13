import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { Roles } from '../auth/decorators/roles.decorator'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { TenantOperationsService } from './tenant-operations.service'

type AuthenticatedRequest = Request & { user: { orgId: string } }

@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Roles('ADMIN')
@Controller('v1/operations')
export class TenantOperationsController {
  constructor(private readonly service: TenantOperationsService) {}

  @Get('tenant-summary')
  getSummary(@Req() req: AuthenticatedRequest) {
    return this.service.getSummary(req.user.orgId)
  }
}
