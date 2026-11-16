import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ServiceUnavailableException, ConflictException } from '@nestjs/common';
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
    invitedEmail = invitedEmail.trim().toLowerCase();
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      throw new ServiceUnavailableException('Envio de convites indisponível.');
    }

    // E-mail é globalmente único: um convite jamais pode transferir uma conta.
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitedEmail },
    });
    if (existingUser) {
      throw new BadRequestException('Este e-mail já possui uma conta ou convite.');
    }

    const token = uuidv4();
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await this.prisma.user.create({
      data: {
        email: invitedEmail,
        inviteToken: hashedToken,
        orgId,
        inviteExpiresAt: expiresAt,
        role: prismaRole,
        active: false,
      },
    });

    const inviteLink = `${frontendUrl}/auth/accept-invite?token=${token}&email=${encodeURIComponent(invitedEmail)}`;

    let delivered = false;
    try {
      delivered = await this.emailService.sendInvite(invitedEmail, inviteLink, inviterName);
    } catch {
      delivered = false;
    }
    if (!delivered) {
      await this.prisma.user.deleteMany({
        where: { id: invite.id, orgId, active: false, inviteToken: hashedToken },
      });
      throw new ServiceUnavailableException('Não foi possível enviar o convite. Tente novamente.');
    }

    return { id: invite.id, email: invite.email, role: invite.role, inviteExpiresAt: invite.inviteExpiresAt };
  }

  private invitationWhere(orgId: string, id: string) {
    return { id, orgId, active: false, password: null, inviteExpiresAt: { not: null }, person: { is: null } };
  }

  async resendInvite(orgId: string, id: string, inviterName: string, actorUserId?: string) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    if (!frontendUrl) throw new ServiceUnavailableException('Envio de convites indisponível.');
    const where = this.invitationWhere(orgId, id);
    const previous = await this.prisma.user.findFirst({ where });
    if (!previous) throw new NotFoundException('Convite não encontrado.');
    const token = uuidv4();
    const hashedToken = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.$transaction(async tx => {
      const result = await tx.user.updateMany({
        where: { ...where, inviteToken: previous.inviteToken, inviteExpiresAt: previous.inviteExpiresAt },
        data: { inviteToken: hashedToken, inviteExpiresAt: expiresAt },
      });
      if (result.count !== 1) throw new ConflictException('O convite foi alterado. Atualize a lista.');
      await tx.auditEvent.create({ data: { orgId, actorUserId, action: 'INVITE_RESEND_REQUESTED', entityType: 'USER', entityId: id } });
    });
    let delivered = false;
    try {
      delivered = await this.emailService.sendInvite(previous.email,
        `${frontendUrl}/auth/accept-invite?token=${token}&email=${encodeURIComponent(previous.email)}`, inviterName);
    } catch { delivered = false; }
    if (!delivered) {
      // Não sobrescreve um aceite, revogação ou reenvio posterior.
      await this.prisma.$transaction(async tx => {
        await tx.user.updateMany({
          where: { ...where, inviteToken: hashedToken },
          data: { inviteToken: previous.inviteToken, inviteExpiresAt: previous.inviteExpiresAt },
        });
        await tx.auditEvent.create({ data: { orgId, actorUserId, action: 'INVITE_RESEND_FAILED', entityType: 'USER', entityId: id } });
      });
      throw new ServiceUnavailableException('Não foi possível reenviar o convite. Tente novamente.');
    }
    return { id, email: previous.email, role: previous.role, inviteExpiresAt: expiresAt };
  }

  async revokeInvite(orgId: string, id: string, actorUserId?: string) {
    const where = this.invitationWhere(orgId, id);
    return this.prisma.$transaction(async tx => {
      const invitation = await tx.user.findFirst({ where });
      if (!invitation) throw new NotFoundException('Convite não encontrado.');
      if (!invitation.inviteToken) return { success: true };
      const result = await tx.user.updateMany({
        where: { ...where, inviteToken: invitation.inviteToken, inviteExpiresAt: invitation.inviteExpiresAt },
        data: { inviteToken: null },
      });
      if (result.count !== 1) throw new ConflictException('O convite foi alterado. Atualize a lista.');
      await tx.auditEvent.create({ data: { orgId, actorUserId, action: 'INVITE_REVOKED', entityType: 'USER', entityId: id } });
      return { success: true };
    });
  }

  async acceptInvite(email: string, rawToken: string, name: string, password?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), active: false, password: null, inviteExpiresAt: { gt: new Date() } },
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

    const updatedUser = await this.prisma.$transaction(async tx => {
      const claimed = await tx.user.updateMany({
        where: { id: user.id, orgId: user.orgId, active: false, password: null, inviteToken: user.inviteToken, inviteExpiresAt: { gt: new Date() } },
        data: { password: hashedPassword, active: true, inviteToken: null, inviteExpiresAt: null },
      });
      if (claimed.count !== 1) throw new ConflictException('Convite alterado, revogado ou já utilizado.');
      const activated = await tx.user.update({
        where: { id: user.id },
        data: { person: { create: { name: safeName, email: user.email, role: user.role, orgId: user.orgId } } },
        include: { person: true },
      });
      await tx.auditEvent.create({ data: { orgId: user.orgId, actorUserId: user.id, action: 'INVITE_ACCEPTED', entityType: 'USER', entityId: user.id } });
      return activated;
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
      select: { id: true, email: true, role: true, active: true, updatedAt: true, createdAt: true, person: { select: { name: true } } },
    });

    const evaluatedAt = new Date();
    const records = await this.prisma.user.findMany({
      where: { orgId, active: false, password: null, inviteExpiresAt: { not: null }, person: { is: null } },
      select: { id: true, email: true, inviteExpiresAt: true, inviteToken: true, role: true, createdAt: true },
    });
    const invitations = records.map(({ inviteToken, ...invitation }) => ({
      ...invitation,
      status: !inviteToken ? 'REVOKED' : invitation.inviteExpiresAt! > evaluatedAt ? 'PENDING' : 'EXPIRED',
    }));
    const pendingInvites = invitations.filter(invitation => invitation.status === 'PENDING');
    return { users, pendingInvites, invitations };
  }
}
