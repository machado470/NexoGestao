import { Controller, Post, Get, Req, UseGuards, Body } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OnboardingService } from "./onboarding.service";
import { Throttle } from "@nestjs/throttler";
import { CompleteOnboardingStepDto } from "./dto/complete-onboarding-step.dto";

@Controller("onboarding")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get("status")
  async getOnboardingStatus(@Req() req: any) {
    const orgId = req.user.orgId;
    return this.onboardingService.getOnboardingStatus(orgId);
  }

  @Post("complete")
  @Roles("ADMIN", "MANAGER")
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  async completeOnboarding(@Req() req: any) {
    const orgId = req.user.orgId;
    return this.onboardingService.completeOnboarding(orgId);
  }

  @Post("complete-step")
  @Roles("ADMIN", "MANAGER")
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  async completeOnboardingStep(
    @Req() req: any,
    @Body() body: CompleteOnboardingStepDto,
  ) {
    const orgId = req.user.orgId;
    return this.onboardingService.completeOnboardingStep(orgId, body.step);
  }
}
