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
  @Post('request')
  request(@Request() req: any, @Body() body: { actionType: OperationalActionType; entityType: string; entityId: string; sourceSignalId?: string; metadata?: Record<string, unknown> }) {
    return this.actions.request({ orgId: req.user.orgId, actorUserId: req.user.id, actionType: body.actionType, entityType: body.entityType, entityId: body.entityId, sourceSignalId: body.sourceSignalId, metadata: body.metadata })
  }
  @Post('execute')
  execute(@Request() req: any, @Body() body: { actionType: OperationalActionType; entityType: string; entityId: string; sourceSignalId?: string; metadata?: Record<string, unknown> }) {
    return this.actions.execute({ orgId: req.user.orgId, actorUserId: req.user.id, actionType: body.actionType, entityType: body.entityType, entityId: body.entityId, sourceSignalId: body.sourceSignalId, metadata: body.metadata })
  }

  @Post('cancel')
  cancel(@Request() req: any, @Body() body: { actionType: OperationalActionType; entityType: string; entityId: string; sourceSignalId?: string; metadata?: Record<string, unknown> }) {
    return this.actions.cancel({ orgId: req.user.orgId, actorUserId: req.user.id, actionType: body.actionType, entityType: body.entityType, entityId: body.entityId, sourceSignalId: body.sourceSignalId, metadata: body.metadata })
  }
}
