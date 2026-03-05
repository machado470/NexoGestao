import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { InvoicesService } from './invoices.service'
import { CreateInvoiceDto, InvoiceStatus } from './dto/create-invoice.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @Roles('ADMIN')
  async list(
    @Org() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: InvoiceStatus,
    @Query('customerId') customerId?: string,
    @Query('q') q?: string,
  ) {
    return this.invoices.list(orgId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      customerId,
      q,
    })
  }

  @Get('summary')
  @Roles('ADMIN')
  async summary(@Org() orgId: string) {
    return this.invoices.summary(orgId)
  }

  @Get(':id')
  @Roles('ADMIN')
  async findOne(@Org() orgId: string, @Param('id') id: string) {
    return this.invoices.findOne(orgId, id)
  }

  @Post()
  @Roles('ADMIN')
  async create(@Org() orgId: string, @Body() body: CreateInvoiceDto) {
    return this.invoices.create(orgId, body)
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(
    @Org() orgId: string,
    @Param('id') id: string,
    @Body() body: Partial<CreateInvoiceDto>,
  ) {
    return this.invoices.update(orgId, id, body)
  }

  @Delete(':id')
  @Roles('ADMIN')
  async delete(@Org() orgId: string, @Param('id') id: string) {
    return this.invoices.delete(orgId, id)
  }
}
