import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'

import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'

import { OperationalStateGuard } from '../people/operational-state.guard'
import { AssignmentsService } from './assignments.service'

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
  async start(@Param('id') id: string) {
    return this.service.startAssignment(id)
  }

  /**
   * 🔎 PRÓXIMO ITEM DA TRILHA
   */
  @Get(':id/next-item')
  @UseGuards(OperationalStateGuard)
  async nextItem(@Param('id') id: string) {
    return this.service.getNextItem(id)
  }

  /**
   * ✅ CONCLUIR ITEM DA TRILHA
   */
  @Post(':id/complete-item')
  @UseGuards(OperationalStateGuard)
  async completeItem(
    @Param('id') assignmentId: string,
    @Body() body: { itemId: string },
  ) {
    return this.service.completeItem(
      assignmentId,
      body.itemId,
    )
  }

  /**
   * 🛠️ REBUILD PROGRESS
   */
  @Post(':id/rebuild-progress')
  @UseGuards(OperationalStateGuard)
  async rebuildProgress(@Param('id') assignmentId: string) {
    return this.service.rebuildProgress(assignmentId)
  }
}
