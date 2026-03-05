import { Controller, Get, Post, Param, UseGuards, Request, Patch } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PlanName } from '@prisma/client';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getSubscriptionStatus(@Request() req) {
    const orgId = req.user.orgId;
    return this.subscriptionsService.checkSubscriptionStatus(orgId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(':planName')
  async updateSubscription(@Request() req, @Param('planName') planName: PlanName) {
    const orgId = req.user.orgId;
    return this.subscriptionsService.updateSubscription(orgId, planName);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('cancel')
  async cancelSubscription(@Request() req) {
    const orgId = req.user.orgId;
    return this.subscriptionsService.cancelSubscription(orgId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('organization')
  async getOrganizationSubscription(@Request() req) {
    const orgId = req.user.orgId;
    return this.subscriptionsService.getOrganizationSubscription(orgId);
  }
}
