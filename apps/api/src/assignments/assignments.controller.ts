import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'

import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'

import { OperationalStateGuard } from '../people/operational-state.guard'
import { AssignmentsService } from './assignments.service'

function isAdmin(user: any): boolean {
  const roles = user?.roles
  if (Array.isArray(roles)) return roles.includes('ADMIN')
  const role = user?.role
  if (typeof role === 'string') return role === 'ADMIN'
  return false
}

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(
    private readonly service: AssignmentsService,
  ) {}

  /**
   * 📋 ADMIN: LISTAGEM POR PESSOA (ORG-SCOPED)
   */
  @Get('person/:personId')
  @Roles('ADMIN')
  async listByPerson(
    @Org() orgId: string,
    @Param('personId') personId: string,
  ) {
    return this.service.listOpenByPersonInOrg(orgId, personId)
  }

  /**
   * ▶️ INICIAR ASSIGNMENT
   */
  @Post(':id/start')
  @UseGuards(OperationalStateGuard)
  async start(
    @Param('id') id: string,
    @Req() req: any,
    @User() user: any,
  ) {
    const u = user ?? req?.user ?? null

    return this.service.startAssignment(id, {
      orgId: u?.orgId ?? null,
      actorUserId: u?.userId ?? u?.sub ?? null,
      actorPersonId: u?.personId ?? null,
      isAdmin: isAdmin(u),
    })
  }

  /**
   * 🔎 PRÓXIMO ITEM DA TRILHA
   */
  @Get(':id/next-item')
  @UseGuards(OperationalStateGuard)
  async nextItem(
    @Param('id') id: string,
    @Req() req: any,
    @User() user: any,
  ) {
    const u = user ?? req?.user ?? null

    return this.service.getNextItem(id, {
      orgId: u?.orgId ?? null,
      actorUserId: u?.userId ?? u?.sub ?? null,
      actorPersonId: u?.personId ?? null,
      isAdmin: isAdmin(u),
    })
  }

  /**
   * ✅ CONCLUIR ITEM DA TRILHA
   */
  @Post(':id/complete-item')
  @UseGuards(OperationalStateGuard)
  async completeItem(
    @Param('id') assignmentId: string,
    @Body() body: { itemId: string },
    @Req() req: any,
    @User() user: any,
  ) {
    const u = user ?? req?.user ?? null

    return this.service.completeItem(
      assignmentId,
      body.itemId,
      {
        orgId: u?.orgId ?? null,
        actorUserId: u?.userId ?? u?.sub ?? null,
        actorPersonId: u?.personId ?? null,
        isAdmin: isAdmin(u),
      },
    )
  }

  /**
   * 🛠️ REBUILD PROGRESS
   */
  @Post(':id/rebuild-progress')
  @UseGuards(OperationalStateGuard)
  async rebuildProgress(
    @Param('id') assignmentId: string,
    @Req() req: any,
    @User() user: any,
  ) {
    const u = user ?? req?.user ?? null

    return this.service.rebuildProgress(assignmentId, {
      orgId: u?.orgId ?? null,
      actorUserId: u?.userId ?? u?.sub ?? null,
      actorPersonId: u?.personId ?? null,
      isAdmin: isAdmin(u),
    })
  }
}
