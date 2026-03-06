import { Controller, Post, Get, Req, UseGuards, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  async getOnboardingStatus(@Req() req: any) {
    const orgId = req.user.orgId;
    return this.onboardingService.getOnboardingStatus(orgId);
  }


  @Post('complete')
  async completeOnboarding(@Req() req: any) {
    const orgId = req.user.orgId;
    return this.onboardingService.completeOnboardingStep(orgId, 'createCharge');
  }

  @Post('complete-step')
  async completeOnboardingStep(@Req() req: any, @Body('step') step: 'createCustomer' | 'createService' | 'createCharge') {
    const orgId = req.user.orgId;
    return this.onboardingService.completeOnboardingStep(orgId, step);
  }
}
