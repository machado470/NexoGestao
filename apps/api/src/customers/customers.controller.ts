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

type CreateCustomerDTO = {
  name: string
  phone: string
  email?: string
  notes?: string
}

type UpdateCustomerDTO = {
  name?: string
  phone?: string
  email?: string
  notes?: string
  active?: boolean
}

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
    @Body() body: CreateCustomerDTO,
  ) {
    return this.customers.create({
      orgId,
      createdBy: user?.userId ?? user?.sub ?? null,
      personId: user?.personId ?? null,
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
    @Body() body: UpdateCustomerDTO,
  ) {
    return this.customers.update({
      orgId,
      updatedBy: user?.userId ?? user?.sub ?? null,
      personId: user?.personId ?? null,
      id,
      data: body,
    })
  }
}
