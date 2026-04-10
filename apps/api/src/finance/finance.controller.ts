import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import { Response } from 'express'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'
import { OperationalStateGuard } from '../people/operational-state.guard'
import { FinanceService } from './finance.service'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { ChargesQueryDto } from './dto/charges-query.dto'
import { CreateChargeDto } from './dto/create-charge.dto'
import { UpdateChargeDto } from './dto/update-charge.dto'
import { TenantOperationsService } from '../common/tenant-ops/tenant-ops.service'

type AuthUser = { userId?: string; sub?: string } | null | undefined

function parseDueDate(value?: string | Date | null): Date | undefined {
  if (value == null) return undefined
  if (value instanceof Date) return value

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('dueDate inválido')
  }

  return parsed
}

@UseGuards(JwtAuthGuard, RolesGuard, OperationalStateGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly tenantOps: TenantOperationsService,
  ) {}

  @Get('overview')
  @Roles('ADMIN', 'MANAGER')
  async overview(@Org() orgId: string) {
    const data = await this.finance.overview(orgId)
    return { ok: true, data }
  }

  @Post('charges/automation/overdue')
  @Roles('ADMIN', 'MANAGER')
  async processOverdue(@Org() orgId: string) {
    const data = await this.finance.automateOverdueLifecycle(orgId)
    return { ok: true, data }
  }

  @Get('charges')
  @Roles('ADMIN', 'MANAGER')
  async listCharges(@Org() orgId: string, @Query() query: ChargesQueryDto) {
    const data = await this.finance.listCharges(orgId, query)
    return { ok: true, data }
  }

  @Get('charges/export')
  @Roles('ADMIN', 'MANAGER')
  async exportCharges(@Org() orgId: string, @Res() res: Response) {
    const csv = await this.finance.exportChargesCsv(orgId)
    res.set('Content-Type', 'text/csv')
    res.attachment(`charges-${orgId}-${Date.now()}.csv`)
    return res.send(csv)
  }

  @Get('charges/stats')
  @Roles('ADMIN', 'MANAGER')
  async getChargeStats(@Org() orgId: string) {
    const data = await this.finance.getChargeStats(orgId)
    return { ok: true, data }
  }

  @Get('charges/revenue-by-month')
  @Roles('ADMIN', 'MANAGER')
  async getRevenueByMonth(@Org() orgId: string) {
    const data = await this.finance.getRevenueByMonth(orgId)
    return { ok: true, data }
  }

  @Get('charges/:id')
  @Roles('ADMIN', 'MANAGER')
  async getCharge(@Org() orgId: string, @Param('id') id: string) {
    const data = await this.finance.getCharge(orgId, id)
    return { ok: true, data }
  }

  @Get('payments/:id')
  @Roles('ADMIN', 'MANAGER')
  async getPayment(@Org() orgId: string, @Param('id') id: string) {
    const data = await this.finance.getPayment(orgId, id)
    return { ok: true, data }
  }

  @Post('charges')
  @Roles('ADMIN', 'MANAGER')
  async createCharge(
    @Org() orgId: string,
    @User() user: AuthUser,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: CreateChargeDto,
  ) {
    const createChargeLimit = this.tenantOps.enforceLimit({
      orgId,
      scope: 'finance:create-charge',
      limit: 40,
      windowMs: 60_000,
      blockedReason: 'tenant_finance_create_charge_rate_limit',
    })
    if (!createChargeLimit.allowed) {
      this.tenantOps.recordCriticalEvent(orgId, 'finance_create_charge_blocked', {
        reason: createChargeLimit.reason,
        used: createChargeLimit.used,
      })
      throw new BadRequestException(
        `Criação de cobrança bloqueada temporariamente: ${createChargeLimit.reason}`,
      )
    }

    const actorUserId = user?.userId ?? user?.sub ?? null
    const dueDate = parseDueDate(body.dueDate)
    if (!dueDate) throw new BadRequestException('dueDate é obrigatório')

    const data = await this.finance.createCharge({
      orgId,
      customerId: body.customerId,
      amountCents: body.amountCents,
      dueDate,
      notes: body.notes,
      serviceOrderId: body.serviceOrderId,
      idempotencyKey: body.idempotencyKey ?? idempotencyKeyHeader,
      actorUserId,
    })
    this.tenantOps.increment(orgId, 'finance_charge_create')

    return { ok: true, data }
  }

  @Patch('charges/:id')
  @Roles('ADMIN', 'MANAGER')
  async updateCharge(
    @Org() orgId: string,
    @User() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateChargeDto,
  ) {
    const actorUserId = user?.userId ?? user?.sub ?? null

    const data = await this.finance.updateCharge({
      id,
      orgId,
      actorUserId,
      amountCents: body.amountCents,
      dueDate: parseDueDate(body.dueDate),
      status: body.status,
      notes: body.notes,
      expectedUpdatedAt: body.expectedUpdatedAt,
    })

    return { ok: true, data }
  }

  @Delete('charges/:id')
  @Roles('ADMIN', 'MANAGER')
  async deleteCharge(
    @Org() orgId: string,
    @User() user: AuthUser,
    @Param('id') id: string,
  ) {
    const actorUserId = user?.userId ?? user?.sub ?? null

    await this.finance.deleteCharge({
      orgId,
      id,
      actorUserId,
    })

    return { ok: true }
  }

  @Post('charges/:chargeId/pay')
  @Throttle({ short: { limit: 8, ttl: 60000 } })
  @Roles('ADMIN', 'MANAGER')
  async payCharge(
    @Org() orgId: string,
    @User() user: AuthUser,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Param('chargeId') chargeId: string,
    @Body() body: CreatePaymentDto,
  ) {
    const payLimit = this.tenantOps.enforceLimit({
      orgId,
      scope: 'finance:pay-charge',
      limit: 30,
      windowMs: 60_000,
      blockedReason: 'tenant_finance_pay_charge_rate_limit',
    })
    if (!payLimit.allowed) {
      this.tenantOps.recordCriticalEvent(orgId, 'finance_pay_charge_blocked', {
        reason: payLimit.reason,
        used: payLimit.used,
      })
      throw new BadRequestException(
        `Pagamento bloqueado temporariamente: ${payLimit.reason}`,
      )
    }

    const actorUserId = user?.userId ?? user?.sub ?? null

    const data = await this.finance.payCharge({
      orgId,
      chargeId,
      actorUserId,
      method: body.method,
      amountCents: body.amountCents,
      idempotencyKey: body.idempotencyKey ?? idempotencyKeyHeader,
    })
    this.tenantOps.increment(orgId, 'finance_charge_pay')

    return { ok: true, data }
  }

  @Post('charges/:chargeId/remind')
  @Roles('ADMIN', 'MANAGER')
  async remindCharge(
    @Org() orgId: string,
    @Param('chargeId') chargeId: string,
  ) {
    await this.finance.remindChargeInOrg(orgId, chargeId)
    return { ok: true }
  }
}
