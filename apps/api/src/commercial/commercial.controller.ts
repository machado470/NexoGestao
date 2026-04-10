import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { Org } from '../auth/decorators/org.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { CommercialPolicyService } from '../common/commercial/commercial-policy.service'
import { UpsertFeatureOverrideDto } from './dto/upsert-feature-override.dto'

@UseGuards(JwtAuthGuard)
@Controller('commercial')
export class CommercialController {
  constructor(private readonly commercial: CommercialPolicyService) {}

  @Get('context')
  async getCommercialContext(@Org() orgId: string) {
    const context = await this.commercial.getContext(orgId)
    return {
      ok: true,
      data: {
        plan: {
          code: context.planName,
          name: context.planDisplayName,
        },
        subscription: {
          status: context.subscription.status,
          currentPeriodStart: context.subscription.currentPeriodStart,
          currentPeriodEnd: context.subscription.currentPeriodEnd,
        },
        limits: context.limits,
        features: context.features,
        overrides: context.featureOverrides,
      },
    }
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/commercial')
export class AdminCommercialController {
  constructor(private readonly commercial: CommercialPolicyService) {}

  @Get('tenants')
  @Roles('ADMIN')
  async getTenantsCommercialOverview() {
    return {
      ok: true,
      data: await this.commercial.getAdminTenantCommercialOverview(),
    }
  }

  @Patch('tenants/:orgId/features/:featureKey')
  @Roles('ADMIN')
  async upsertFeatureOverride(
    @Param('orgId') orgId: string,
    @Param('featureKey') featureKey: string,
    @Body() body: UpsertFeatureOverrideDto,
  ) {
    const updated = await this.commercial.upsertFeatureOverride(orgId, featureKey, body.enabled, body.reason)
    return { ok: true, data: updated }
  }
}
