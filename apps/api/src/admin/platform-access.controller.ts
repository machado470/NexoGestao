import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard'
import { Roles } from '../auth/decorators/roles.decorator'

/**
 * Answers "is this session a platform operator?" without returning any data. The BFF uses it
 * to authorize platform-only diagnostics, so the decision stays on the API side: a verified
 * session, an active ADMIN in its own organization, and an id in PLATFORM_ADMIN_USER_IDS
 * (deny by default when the allowlist is empty). An organization ADMIN alone gets 403.
 */
@Controller('admin/platform-access')
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard, PlatformAdminGuard)
export class PlatformAccessController {
  @Get()
  @Roles('ADMIN')
  check() {
    return { platformAdmin: true }
  }
}
