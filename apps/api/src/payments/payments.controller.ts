import {
  Controller,
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
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
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
      customerId: string
      amount: number
      description: string
      successUrl: string
      cancelUrl: string
    },
  ) {
    const result = await this.payments.createCheckoutSession({
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
    const stripeSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')

    if (!stripeSecret || !signature) {
      return { ok: false, error: 'Webhook não configurado' }
    }

    try {
      // Verificar assinatura do webhook
      const hash = crypto
        .createHmac('sha256', stripeSecret)
        .update(req.rawBody)
        .digest('hex')

      if (hash !== signature) {
        return { ok: false, error: 'Assinatura inválida' }
      }

      const payload = JSON.parse(req.rawBody.toString())
      await this.payments.processWebhook(payload)

      return { ok: true }
    } catch (error) {
      console.error('Erro ao processar webhook Stripe:', error)
      return { ok: false, error: String(error) }
    }
  }

  /**
   * Lista cobranças
   */
  @Get('charges')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listCharges(@Org() orgId: string) {
    const charges = await this.payments.listCharges(orgId)
    return { ok: true, data: charges }
  }

  /**
   * Marca uma cobrança como paga
   */
  @Post('charges/:chargeId/pay')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async payCharge(
    @Param('chargeId') chargeId: string,
    @Body() body: { paymentMethod?: string },
  ) {
    await this.payments.markChargeAsPaid(chargeId, body.paymentMethod || 'manual')
    return { ok: true, message: 'Cobrança marcada como paga' }
  }
}
