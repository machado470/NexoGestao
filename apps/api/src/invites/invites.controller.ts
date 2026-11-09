import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ActiveUserGuard } from '../auth/guards/active-user.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('auth')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('invite')
  async createInvite(@Request() req, @Body() createInviteDto: CreateInviteDto) {
    const inviterName = req.user.email; // Ou o nome do usuário logado
    const orgId = req.user.orgId;
    return this.invitesService.createInvite(orgId, createInviteDto.email, inviterName, createInviteDto.role);
  }

  @UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('invites/:id/resend')
  async resendInvite(@Request() req, @Param('id') id: string) {
    return this.invitesService.resendInvite(req.user.orgId, id, req.user.email, req.user.sub);
  }

  @UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('invites/:id/revoke')
  async revokeInvite(@Request() req, @Param('id') id: string) {
    return this.invitesService.revokeInvite(req.user.orgId, id, req.user.sub);
  }

  @Public()
  @Post('accept-invite')
  async acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
    return this.invitesService.acceptInvite(acceptInviteDto.email, acceptInviteDto.token, acceptInviteDto.name, acceptInviteDto.password);
  }

  @UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('organization/members')
  async getOrganizationMembers(@Request() req) {
    const orgId = req.user.orgId;
    return this.invitesService.getOrganizationMembers(orgId);
  }
}
