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

import { ServiceOrdersService } from './service-orders.service'

type CreateServiceOrderDTO = {
  customerId: string
  title: string
  description?: string
  priority?: number
  scheduledFor?: string
  appointmentId?: string
  assignedToPersonId?: string
}

type UpdateServiceOrderDTO = {
  title?: string
  description?: string
  priority?: number
  scheduledFor?: string
  status?: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELED'
  assignedToPersonId?: string | null
}

@Controller('service-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceOrdersController {
  constructor(private readonly serviceOrders: ServiceOrdersService) {}

  @Get()
  @Roles('ADMIN')
  list(
    @Org() orgId: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('assignedToPersonId') assignedToPersonId?: string,
  ) {
    return this.serviceOrders.list(orgId, {
      status: status as any,
      customerId,
      assignedToPersonId,
    })
  }

  @Get(':id')
  @Roles('ADMIN')
  get(@Org() orgId: string, @Param('id') id: string) {
    return this.serviceOrders.get(orgId, id)
  }

  @Post()
  @Roles('ADMIN')
  create(
    @Org() orgId: string,
    @User() user: any,
    @Body() body: CreateServiceOrderDTO,
  ) {
    return this.serviceOrders.create({
      orgId,
      createdBy: user?.sub ?? null,
      personId: user?.personId ?? null,
      customerId: body.customerId,
      title: body.title,
      description: body.description,
      priority: body.priority,
      scheduledFor: body.scheduledFor,
      appointmentId: body.appointmentId,
      assignedToPersonId: body.assignedToPersonId,
    })
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Org() orgId: string,
    @User() user: any,
    @Param('id') id: string,
    @Body() body: UpdateServiceOrderDTO,
  ) {
    return this.serviceOrders.update({
      orgId,
      updatedBy: user?.sub ?? null,
      personId: user?.personId ?? null,
      id,
      data: body as any,
    })
  }
}
