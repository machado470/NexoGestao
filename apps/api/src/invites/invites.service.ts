import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import type { UserRole } from '@prisma/client';
import type { InviteUserRole } from './dto/create-invite.dto';

@Injectable()
export class InvitesService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async createInvite(orgId: string, invitedEmail: string, inviterName: string, role: InviteUserRole) {
    const prismaRole = role as UserRole;

    const existingUser = await this.prisma.user.findFirst({
      where: { orgId, email: invitedEmail },
    });
    if (existingUser) {
      throw new BadRequestException('Já existe um usuário com este e-mail nesta organização.');
    }

    const existingInvite = await this.prisma.inviteToken.findFirst({
      where: { orgId, email: invitedEmail, expiresAt: { gt: new Date() } },
    });
    if (existingInvite) {
      throw new BadRequestException('Já existe um convite pendente para este e-mail nesta organização.');
    }

    const token = uuidv4();
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await this.prisma.inviteToken.create({
      data: {
        email: invitedEmail,
        token: hashedToken,
        orgId,
        expiresAt,
        role: prismaRole,
      },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL não configurada no ambiente.');
    }
    const inviteLink = `${frontendUrl}/auth/accept-invite?token=${token}&email=${encodeURIComponent(invitedEmail)}`;

    await this.emailService.sendInvite(invitedEmail, inviteLink, inviterName);

    return invite;
  }

  async acceptInvite(email: string, rawToken: string, name: string, password?: string) {
    const invite = await this.prisma.inviteToken.findFirst({
      where: { email, expiresAt: { gt: new Date() } },
      include: { org: true },
    });

    if (!invite) {
      throw new NotFoundException('Convite inválido ou expirado.');
    }

    const isTokenValid = await bcrypt.compare(rawToken, invite.token);
    if (!isTokenValid) {
      throw new UnauthorizedException('Token de convite inválido.');
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    const user = await this.prisma.user.create({
      data: {
        email: invite.email,
        password: hashedPassword,
        orgId: invite.orgId,
        role: invite.role,
        active: true,
        person: {
          create: {
            name,
            email: invite.email,
            role: invite.role,
            orgId: invite.orgId,
          },
        },
      },
    });

    await this.prisma.inviteToken.delete({ where: { id: invite.id } });

    return user;
  }

  async getOrganizationMembers(orgId: string) {
    const users = await this.prisma.user.findMany({
      where: { orgId },
      select: { id: true, email: true, role: true, active: true, createdAt: true, person: { select: { name: true } } },
    });

    const pendingInvites = await this.prisma.inviteToken.findMany({
      where: { orgId, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, expiresAt: true, role: true, createdAt: true },
    });

    return { users, pendingInvites };
  }
}
