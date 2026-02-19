import { Controller, Get, UseGuards, Req } from '@nestjs/common'
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
   * 👤 USUÁRIO (ME)
   * personId vem do token
   * - usado pela UI / fluxo do usuário
   */
  @Get('me')
  me(@Req() req: any) {
    const personId = req?.user?.personId ?? null
    if (!personId) {
      // token sem personId = não tem “pessoa” vinculada
      return {
        count: 0,
        items: [],
      }
    }
    return this.service.listByPerson(personId)
  }

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
