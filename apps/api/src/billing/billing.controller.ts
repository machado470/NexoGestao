import { SkipThrottle, Throttle } from '@nestjs/throttler'
import { MINUTE_MS, SKIP_ALL_THROTTLERS, SensitiveThrottle } from '../common/throttling/throttling'
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
import { RolesGuard } from '../auth/guards/roles.guard'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto'


@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /*
  ========================================
  CREATE CHECKOUT SESSION
  ========================================
  */

  @UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('create-checkout-session')
  @SensitiveThrottle()
  async createCheckoutSession(
    @Req() req: any,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    const orgId = req.user.orgId

    return this.billingService.createCheckoutSession(
      orgId,
      dto.planName,
      dto.successUrl,
      dto.cancelUrl,
    )
  }

  /*
  ========================================
  STRIPE WEBHOOK
  ========================================
  */

  @Public()
  @Post('webhook')
  // Authenticated by the Stripe signature; retries must not be rate limited.
  @SkipThrottle(SKIP_ALL_THROTTLERS)
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body))
    return this.billingService.handleWebhook(rawBody, signature)
  }

  /*
  ========================================
  SUBSCRIPTION
  ========================================
  */

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  async getSubscription(@Req() req: any) {
    const orgId = req.user.orgId
    return this.billingService.getSubscription(orgId)
  }

  /*
  ========================================
  CANCEL SUBSCRIPTION
  ========================================
  */

  @UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('cancel')
  async cancelSubscription(@Req() req: any) {
    const orgId = req.user.orgId
    return this.billingService.cancelSubscription(orgId)
  }

  /*
  ========================================
  PLANS
  ========================================
  */

  @Public()
  @Get('plans')
  @Throttle({ default: { limit: 120, ttl: MINUTE_MS } })
  async getPlans() {
    return this.billingService.getPlanCatalog()
  }

  /*
  ========================================
  BILLING STATUS
  ========================================
  */

  @UseGuards(JwtAuthGuard)
  @Get('availability')
  async getAvailability(@Req() req: any) {
    return this.billingService.getAvailability(req.user.orgId)
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getBillingStatus(@Req() req: any) {
    const orgId = req.user.orgId
    return this.billingService.getBillingStatus(orgId)
  }

  /*
  ========================================
  BILLING LIMITS
  ========================================
  */

  @UseGuards(JwtAuthGuard)
  @Get('limits')
  async getBillingLimits(@Req() req: any) {
    const orgId = req.user.orgId
    return this.billingService.getBillingLimits(orgId)
  }
}
