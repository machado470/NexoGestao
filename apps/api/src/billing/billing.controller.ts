import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  UseGuards,
  RawBodyRequest,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { Request } from 'express'
import { BillingService } from './billing.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Public } from '../auth/decorators/public.decorator'
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto'
import { PlanName } from '@prisma/client'

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * POST /billing/create-checkout-session
   * Cria uma sessão de checkout no Stripe para o plano escolhido.
   */
  @UseGuards(JwtAuthGuard)
  @Post('create-checkout-session')
  async createCheckoutSession(
    @Req() req: any,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    const orgId = req.user.orgId
    return this.billingService.createCheckoutSession(
      orgId,
      dto.planName as PlanName,
      dto.successUrl,
      dto.cancelUrl,
    )
  }

  /**
   * POST /billing/webhook
   * Recebe eventos do Stripe via webhook (raw body necessário).
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body))
    return this.billingService.handleWebhook(rawBody, signature)
  }

  /**
   * GET /billing/subscription
   * Retorna a assinatura atual da organização com limites do plano.
   */
  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  async getSubscription(@Req() req: any) {
    const orgId = req.user.orgId
    return this.billingService.getSubscription(orgId)
  }

  /**
   * POST /billing/cancel
   * Cancela a assinatura da organização.
   */
  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  async cancelSubscription(@Req() req: any) {
    const orgId = req.user.orgId
    return this.billingService.cancelSubscription(orgId)
  }

  /**
   * GET /billing/plans
   * Lista todos os planos disponíveis.
   */
  @UseGuards(JwtAuthGuard)
  @Get('plans')
  async getPlans(@Req() req: any) {
    // Retorna os planos com limites embutidos
    const { PLAN_LIMITS } = await import('./billing.service')
    return Object.entries(PLAN_LIMITS).map(([name, limits]) => ({
      name,
      label: limits.label,
      limits,
    }))
  }
}
