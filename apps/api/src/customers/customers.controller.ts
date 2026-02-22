import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'

import { CustomersService } from './customers.service'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { UpdateCustomerDto } from './dto/update-customer.dto'

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @Roles('ADMIN')
  list(@Org() orgId: string) {
    return this.customers.list(orgId)
  }

  @Get(':id')
  @Roles('ADMIN')
  get(@Org() orgId: string, @Param('id') id: string) {
    return this.customers.get(orgId, id)
  }

  @Post()
  @Roles('ADMIN')
  create(
    @Org() orgId: string,
    @User() user: any,
    @Body() body: CreateCustomerDto,
  ) {
    const actorUserId = user?.userId ?? null
    const actorPersonId = user?.personId ?? null

    return this.customers.create({
      orgId,
      createdBy: actorUserId,
      personId: actorPersonId,
      name: body.name,
      phone: body.phone,
      email: body.email,
      notes: body.notes,
    })
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Org() orgId: string,
    @User() user: any,
    @Param('id') id: string,
    @Body() body: UpdateCustomerDto,
  ) {
    const actorUserId = user?.userId ?? null
    const actorPersonId = user?.personId ?? null

    return this.customers.update({
      orgId,
      updatedBy: actorUserId,
      personId: actorPersonId,
      id,
      data: body,
    })
  }
}
