import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'

import { AppointmentsService } from './appointments.service'
import { CreateAppointmentDto } from './dto/create-appointment.dto'
import { UpdateAppointmentDto } from './dto/update-appointment.dto'
import { QuotasService } from '../quotas/quotas.service'

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly quotas: QuotasService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'VIEWER')
  list(@Org() orgId: string, @Query() query: any) {
    return this.appointments.list(orgId, query)
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'VIEWER')
  get(@Org() orgId: string, @Param('id') id: string) {
    return this.appointments.get(orgId, id)
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async create(
    @Org() orgId: string,
    @User() user: any,
    @Body() body: CreateAppointmentDto,
  ) {
    await this.quotas.validateQuota(orgId, 'CREATE_APPOINTMENT')

    const actorUserId = user?.userId ?? null
    const actorPersonId = user?.personId ?? null

    return this.appointments.create({
      orgId,
      createdBy: actorUserId,
      personId: actorPersonId,
      customerId: body.customerId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      status: body.status as any,
      notes: body.notes,
    })
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  update(
    @Org() orgId: string,
    @User() user: any,
    @Param('id') id: string,
    @Body() body: UpdateAppointmentDto,
  ) {
    const actorUserId = user?.userId ?? null
    const actorPersonId = user?.personId ?? null

    return this.appointments.update({
      orgId,
      updatedBy: actorUserId,
      personId: actorPersonId,
      id,
      data: body as any,
    })
  }
}
