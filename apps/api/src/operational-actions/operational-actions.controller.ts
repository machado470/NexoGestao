import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { OperationalActionsService, type OperationalActionType } from './operational-actions.service'

@Controller('internal/operational-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class OperationalActionsController {
  constructor(private readonly actions: OperationalActionsService) {}
  @Get()
  list() { return { supportedActionTypes: this.actions.getSupportedActionTypes() } }
  @Post('execute')
  execute(@Request() req: any, @Body() body: { actionType: OperationalActionType; entityId: string; sourceSignalId?: string }) {
    return this.actions.execute({ orgId: req.user.orgId, actorUserId: req.user.id, actionType: body.actionType, entityId: body.entityId, sourceSignalId: body.sourceSignalId })
  }
}
