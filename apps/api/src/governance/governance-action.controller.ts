import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'
import { GovernanceActionService } from './governance-action.service'

type AuthUser = {
  id?: string
  userId?: string
  sub?: string
  personId?: string
} | null | undefined

@Controller('governance/actions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GovernanceActionController {
  constructor(private readonly actionEngine: GovernanceActionService) {}

  @Post('execute')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async executeAction(
    @Org() orgId: string,
    @User() user: AuthUser,
    @Body()
    body: {
      id: string
      type: 'charge' | 'message' | 'assignment' | 'schedule'
      label: string
      description: string
      execute?: unknown
      requiresConfirmation?: boolean
      context: Record<string, unknown>
    },
  ) {
    const actorUserId = user?.id ?? user?.userId ?? user?.sub ?? null
    return this.actionEngine.execute(
      {
        orgId,
        userId: actorUserId,
        personId: user?.personId ?? null,
      },
      body,
    )
  }
}
