import { Body, Controller, Param, ParseUUIDPipe, Patch, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { OrganizationMembersService } from './organization-members.service'
import { UpdateOrganizationMemberDto } from './dto/update-organization-member.dto'

@Controller('auth/organization/members')
@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Roles('ADMIN')
export class OrganizationMembersController {
  constructor(private readonly members: OrganizationMembersService) {}

  @Patch(':id')
  updateMember(@Request() req, @Param('id', ParseUUIDPipe) id: string, @Body() input: UpdateOrganizationMemberDto) {
    return this.members.updateMember(req.user.orgId, req.user.sub, id, input)
  }
}
