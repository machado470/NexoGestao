import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { CreateServiceOrderDto } from './dto/create-service-order.dto'
import { UpdateServiceOrderDto } from './dto/update-service-order.dto'
import { QuotasService } from '../quotas/quotas.service'
import { FinanceService } from '../finance/finance.service'

@Controller('service-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceOrdersController {
  constructor(
    private readonly serviceOrders: ServiceOrdersService,
    private readonly quotas: QuotasService,
    private readonly finance: FinanceService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'VIEWER')
  list(
    @Org() orgId: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('assignedToPersonId') assignedToPersonId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.serviceOrders.list(orgId, {
      status: status as any,
      customerId,
      assignedToPersonId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    })
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'VIEWER')
  get(@Org() orgId: string, @Param('id') id: string) {
    return this.serviceOrders.get(orgId, id)
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  async create(
    @Org() orgId: string,
    @User() user: any,
    @Body() body: CreateServiceOrderDto,
  ) {
    await this.quotas.validateQuota(orgId, 'CREATE_SERVICE_ORDER')

    const actorUserId = user?.userId ?? null
    const actorPersonId = user?.personId ?? null

    return this.serviceOrders.create({
      orgId,
      createdBy: actorUserId,
      personId: actorPersonId,
      customerId: body.customerId,
      title: body.title,
      description: body.description,
      priority: body.priority,
      scheduledFor: body.scheduledFor,
      appointmentId: body.appointmentId,
      assignedToPersonId: body.assignedToPersonId,
      amountCents: body.amountCents,
      dueDate: body.dueDate,
    })
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  update(
    @Org() orgId: string,
    @User() user: any,
    @Param('id') id: string,
    @Body() body: UpdateServiceOrderDto,
  ) {
    const actorUserId = user?.userId ?? null
    const actorPersonId = user?.personId ?? null

    return this.serviceOrders.update({
      orgId,
      updatedBy: actorUserId,
      personId: actorPersonId,
      id,
      data: body as any,
    })
  }

  /**
   * POST /service-orders/:id/generate-charge
   * Gera cobrança manualmente para uma OS finalizada (DONE).
   * Útil quando a geração automática falhou ou foi pulada.
   * Idempotente: se já existe cobrança para a OS, atualiza se necessário.
   */
  @Post(':id/generate-charge')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER')
  async generateCharge(
    @Org() orgId: string,
    @User() user: any,
    @Param('id') id: string,
  ) {
    const actorUserId = user?.userId ?? null
    const actorPersonId = user?.personId ?? null

    const os = await this.serviceOrders.get(orgId, id)

    return this.finance.ensureChargeForServiceOrderDone({
      orgId,
      serviceOrderId: id,
      customerId: os?.customerId ?? undefined,
      amountCents: os?.amountCents ?? 0,
      dueDate: os?.dueDate ?? null,
      actorUserId,
      actorPersonId,
    })
  }
}
