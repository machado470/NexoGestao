import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { AuditAdminService } from './audit-admin.service'

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditAdminController {
  constructor(private readonly auditAdmin: AuditAdminService) {}

  @Get('events')
  @Roles('ADMIN')
  listEvents(
    @Org() orgId: string,
    @Query() query: any,
  ) {
    return this.auditAdmin.listEvents({
      orgId,
      entityType: query.entityType,
      entityId: query.entityId,
      action: query.action,
      actorPersonId: query.actorPersonId,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    })
  }

  @Get('events/:eventId')
  @Roles('ADMIN')
  getEventDetail(
    @Org() orgId: string,
    @Param('eventId') eventId: string,
  ) {
    return this.auditAdmin.getEventDetail(orgId, eventId)
  }

  @Get('summary')
  @Roles('ADMIN')
  getSummary(
    @Org() orgId: string,
    @Query() query: any,
  ) {
    return this.auditAdmin.getSummary({
      orgId,
      from: query.from,
      to: query.to,
    })
  }
}
