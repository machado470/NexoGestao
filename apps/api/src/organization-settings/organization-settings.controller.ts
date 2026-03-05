import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { OrganizationSettingsService } from './organization-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';

@Controller('organization-settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class OrganizationSettingsController {
  constructor(private readonly organizationSettingsService: OrganizationSettingsService) {}

  @Get()
  async getSettings(@Request() req) {
    const orgId = req.user.orgId;
    return this.organizationSettingsService.getOrganizationSettings(orgId);
  }

  @Patch()
  async updateSettings(@Request() req, @Body() updateOrganizationSettingsDto: UpdateOrganizationSettingsDto) {
    const orgId = req.user.orgId;
    return this.organizationSettingsService.updateOrganizationSettings(orgId, updateOrganizationSettingsDto);
  }
}
