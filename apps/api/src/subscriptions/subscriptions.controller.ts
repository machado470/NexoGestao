import { Controller, Get, Post, Param, UseGuards, Request, Patch } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':planName')
  async updateSubscription(@Request() req, @Param('planName') planName: PlanName) {
    const orgId = req.user.orgId;
    return this.subscriptionsService.updateSubscription(orgId, planName);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
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
