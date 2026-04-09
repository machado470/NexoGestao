import {
  BadRequestException,
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

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name)

  constructor(private readonly payments: PaymentsService) {}

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async payCharge(
    @Org() orgId: string,
    @Param('chargeId') chargeId: string,
    @Body() body: { paymentMethod?: string },
  ) {
    await this.payments.markChargeAsPaid(
      orgId,
      chargeId,
      body.paymentMethod || 'manual',
    )
    return { ok: true, message: 'Cobrança marcada como paga' }
  }
}
