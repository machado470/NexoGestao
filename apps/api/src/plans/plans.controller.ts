import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { PlanName } from '@prisma/client'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { PlansService } from './plans.service'
import { CreatePlanDto } from './dto/create-plan.dto'

@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  // Plans are a global catalog shared by every organization.
  @Post()
  @Roles('ADMIN')
  @UseGuards(PlatformAdminGuard)
  async createPlan(@Body() createPlanDto: CreatePlanDto) {
    return this.plansService.createPlan({
      name: createPlanDto.name as PlanName,
      priceCents: createPlanDto.priceCents,
    })
  }

  @Get()
  @Roles('ADMIN')
  async listPlans() {
    return this.plansService.listPlans()
  }
}
