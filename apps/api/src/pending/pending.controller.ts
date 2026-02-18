import { Controller, Get, UseGuards } from '@nestjs/common'
import { PendingService } from './pending.service'

import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'

@Controller('pending')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PendingController {
  constructor(private readonly service: PendingService) {}

  /**
   * 🔎 ADMIN / ORG
   * orgId vem do token (multi-tenant blindado)
   */
  @Get('org')
  @Roles('ADMIN')
  listByOrg(@Org() orgId: string) {
    return this.service.listByOrg(orgId)
  }
}
