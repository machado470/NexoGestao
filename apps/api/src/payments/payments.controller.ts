import {
  BadRequestException,
  NotFoundException,
  Controller,
  Logger,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Headers,
  RawBodyRequest,
  Req,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { PaymentsService } from './payments.service'
import { User } from '../auth/decorators/user.decorator'
import { OperationalStateGuard } from '../people/operational-state.guard'
import { Throttle } from '@nestjs/throttler'
import { ManualPaymentsService } from '../finance/manual-payments.service'
import { PrismaService } from '../prisma/prisma.service'
import { LegacyPaymentDto } from './dto/legacy-payment.dto'

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name)

  constructor(
    private readonly payments: PaymentsService,
    private readonly manualPayments: ManualPaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Cria uma sessão de checkout no Stripe
   */
  @Post('checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createCheckout(
    @Org() orgId: string,
    @Body()
    body: {
      chargeId: string
      customerId: string
      amount: number
      description: string
      successUrl: string
      cancelUrl: string
    },
  ) {
    const result = await this.payments.createCheckoutSession({
      orgId,
      chargeId: body.chargeId,
      customerId: body.customerId,
      amount: body.amount,
      description: body.description,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    })

    return { ok: true, data: result }
  }

  /**
   * Webhook do Stripe para processar pagamentos
   */
  @Post('webhook/stripe')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<any>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Assinatura Stripe ausente')
    }

    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body))
    const result = await this.payments.handleWebhook(rawBody, signature)
    this.logger.log('Webhook Stripe processado com sucesso')
    return { ok: true, data: result }
  }

  /**
   * Lista cobranças
   */
  @Get('charges')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async listCharges(@Org() orgId: string) {
    const charges = await this.payments.listCharges(orgId)
    return { ok: true, data: charges }
  }

  /**
   * Marca uma cobrança como paga
   */
  @Post('charges/:chargeId/pay')
  @Throttle({ short: { limit: 8, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard, OperationalStateGuard)
  @Roles('ADMIN', 'MANAGER')
  async payCharge(
    @Org() orgId: string,
    @Param('chargeId') chargeId: string,
    @User() user: { userId?: string; sub?: string },
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Body() body: LegacyPaymentDto,
  ) {
    if (body.method && body.paymentMethod && body.method !== body.paymentMethod) {
      throw new BadRequestException('Métodos de pagamento divergentes')
    }
    // Legacy callers omit the amount. Resolve it only inside the authenticated tenant.
    const charge = await this.prisma.charge.findFirst({
      where: { id: chargeId, orgId }, select: { amountCents: true },
    })
    if (!charge) throw new NotFoundException('Charge não encontrada')
    await this.manualPayments.pay(orgId, user?.userId ?? user?.sub ?? null, chargeId, {
      method: body.method ?? body.paymentMethod ?? 'OTHER',
      amountCents: body.amountCents ?? charge.amountCents,
      paidAt: body.paidAt,
      notes: body.notes,
      idempotencyKey: body.idempotencyKey,
    }, idempotencyKeyHeader)
    return { ok: true, message: 'Cobrança marcada como paga' }
  }
}
