import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import type { UserRole } from '@prisma/client';
import type { InviteUserRole } from './dto/create-invite.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class InvitesService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  async createInvite(orgId: string, invitedEmail: string, inviterName: string, role: InviteUserRole) {
    const prismaRole = role as UserRole;

    const existingUser = await this.prisma.user.findFirst({
      where: { orgId, email: invitedEmail },
    });
    if (existingUser) {
      throw new BadRequestException('Já existe um usuário com este e-mail nesta organização.');
    }

    const existingInvite = await this.prisma.user.findFirst({
      where: { orgId, email: invitedEmail, inviteExpiresAt: { gt: new Date() } },
    });
    if (existingInvite) {
      throw new BadRequestException('Já existe um convite pendente para este e-mail nesta organização.');
    }

    const token = uuidv4();
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await this.prisma.user.upsert({
      where: { email: invitedEmail },
      create: {
        email: invitedEmail,
        inviteToken: hashedToken,
        orgId,
        inviteExpiresAt: expiresAt,
        role: prismaRole,
        active: false,
      },
      update: {
        inviteToken: hashedToken,
        inviteExpiresAt: expiresAt,
        role: prismaRole,
        orgId,
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
    const user = await this.prisma.user.findFirst({
      where: { email, inviteExpiresAt: { gt: new Date() } },
    });

    if (!user || !user.inviteToken) {
      throw new NotFoundException('Convite inválido ou expirado.');
    }

    const isTokenValid = await bcrypt.compare(rawToken, user.inviteToken);
    if (!isTokenValid) {
      throw new UnauthorizedException('Token de convite inválido.');
    }

    if (!password || password.length < 8) {
      throw new BadRequestException('A senha deve ter no mínimo 8 caracteres.');
    }

    const safeName = (name ?? '').trim() || email.split('@')[0] || 'Usuário';
    const hashedPassword = await bcrypt.hash(password, 10);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        active: true,
        inviteToken: null,
        inviteExpiresAt: null,
        person: {
          create: {
            name: safeName,
            email: user.email,
            role: user.role,
            orgId: user.orgId,
          },
        },
      },
      include: {
        person: true,
      },
    });

    return {
      success: true,
      message: 'Convite aceito com sucesso.',
      ...this.authService.createSessionPayload(updatedUser),
    };
  }

  async getOrganizationMembers(orgId: string) {
    const users = await this.prisma.user.findMany({
      where: { orgId },
      select: { id: true, email: true, role: true, active: true, createdAt: true, person: { select: { name: true } } },
    });

    const pendingInvites = await this.prisma.user.findMany({
      where: { orgId, active: false, inviteExpiresAt: { gt: new Date() } },
      select: { id: true, email: true, inviteExpiresAt: true, role: true, createdAt: true },
    });

    return { users, pendingInvites };
  }
}
