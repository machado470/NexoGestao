import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('auth')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('invite')
  async createInvite(@Request() req, @Body() createInviteDto: CreateInviteDto) {
    const inviterName = req.user.email; // Ou o nome do usuário logado
    const orgId = req.user.orgId;
    return this.invitesService.createInvite(orgId, createInviteDto.email, inviterName, createInviteDto.role);
  }

  @Post('accept-invite')
  async acceptInvite(@Body() acceptInviteDto: AcceptInviteDto) {
    return this.invitesService.acceptInvite(acceptInviteDto.email, acceptInviteDto.token, acceptInviteDto.name, acceptInviteDto.password);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('organization/members')
  async getOrganizationMembers(@Request() req) {
    const orgId = req.user.orgId;
    return this.invitesService.getOrganizationMembers(orgId);
  }
}
