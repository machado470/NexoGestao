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

type CreateAppointmentDTO = {
  customerId: string
  startsAt: string
  endsAt?: string
  status?: 'SCHEDULED' | 'CONFIRMED' | 'CANCELED' | 'DONE' | 'NO_SHOW'
  notes?: string
}

type UpdateAppointmentDTO = {
  startsAt?: string
  endsAt?: string
  status?: 'SCHEDULED' | 'CONFIRMED' | 'CANCELED' | 'DONE' | 'NO_SHOW'
  notes?: string
}

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get()
  @Roles('ADMIN')
  list(
    @Org() orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.appointments.list(orgId, {
      from,
      to,
      status: status as any,
      customerId,
    })
  }

  @Get(':id')
  @Roles('ADMIN')
  get(@Org() orgId: string, @Param('id') id: string) {
    return this.appointments.get(orgId, id)
  }

  @Post()
  @Roles('ADMIN')
  create(
    @Org() orgId: string,
    @User() user: any,
    @Body() body: CreateAppointmentDTO,
  ) {
    return this.appointments.create({
      orgId,
      createdBy: user?.sub ?? null,
      personId: user?.personId ?? null,
      customerId: body.customerId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      status: body.status,
      notes: body.notes,
    })
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Org() orgId: string,
    @User() user: any,
    @Param('id') id: string,
    @Body() body: UpdateAppointmentDTO,
  ) {
    return this.appointments.update({
      orgId,
      updatedBy: user?.sub ?? null,
      personId: user?.personId ?? null,
      id,
      data: body,
    })
  }
}
