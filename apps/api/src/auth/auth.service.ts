import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { Resend } from 'resend'
import { v4 as uuidv4 } from 'uuid'

import { PrismaService } from '../prisma/prisma.service'
import { AnalyticsService, UsageMetricEvent } from '../analytics/analytics.service'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private resend: Resend | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService,
  ) {
    const resendApiKey = this.config.get<string>('RESEND_API_KEY')

    if (resendApiKey && resendApiKey.trim().length > 0) {
      this.resend = new Resend(resendApiKey)
    } else {
      this.logger.warn(
        'RESEND_API_KEY ausente. Recuperação por e-mail ficará desabilitada.',
      )
    }
  }

  async validateGoogleUser(googleUser: any) {
    let user = await this.prisma.user.findUnique({
      where: { email: googleUser.email },
      include: { person: true },
    })

    if (!user) {
      let org = await this.prisma.organization.findFirst({
        where: { slug: 'default' },
      })

      if (!org) {
        org = await this.prisma.organization.create({
          data: {
            name: 'Minha Organização',
            slug: `org-${Date.now()}`,
            requiresOnboarding: true,
          },
        })
      }

      user = await this.prisma.user.create({
        data: {
          email: googleUser.email,
          role: 'ADMIN',
          active: true,
          orgId: org.id,
          person: {
            create: {
              name: `${googleUser.firstName} ${googleUser.lastName}`,
              email: googleUser.email,
              role: 'ADMIN',
              orgId: org.id,
            },
          },
        },
        include: { person: true },
      })
    }

    return this.generateToken(user)
  }

  private generateToken(user: any) {
    const token = this.jwt.sign({
      sub: user.id,
      role: user.role,
      orgId: user.orgId,
      personId: user.person?.id,
    })

    return {
      token,
      user: {
        id: user.id,
        role: user.role,
        orgId: user.orgId,
        personId: user.person?.id,
      },
    }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return {
        success: true,
        message: 'Se o e-mail existir, um link de recuperação será enviado.',
      }
    }

    const token = uuidv4()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    const resetLink = `${frontendUrl}/auth/reset-password?token=${token}`

    if (this.resend) {
      try {
        await this.resend.emails.send({
          from: this.config.get<string>('EMAIL_FROM') || 'onboarding@resend.dev',
          to: email,
          subject: 'Recuperação de Senha - NexoGestao',
          html: `<p>Você solicitou a recuperação de senha. Clique no link abaixo para redefinir:</p><a href="${resetLink}">${resetLink}</a><p>Este link expira em 1 hora.</p>`,
        })
      } catch (error) {
        this.logger.error(
          `Erro ao enviar e-mail de recuperação: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    } else {
      this.logger.warn(
        `Recuperação de senha solicitada para ${email}, mas o Resend não está configurado.`,
      )
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiresAt: expiresAt,
      },
    })

    return {
      success: true,
      message: 'Se o e-mail existir, um link de recuperação será enviado.',
    }
  }

  async resetPassword(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiresAt: {
          gt: new Date(),
        },
      },
    })

    if (!user) {
      throw new UnauthorizedException('Token inválido ou expirado')
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    })

    return { success: true, message: 'Senha redefinida com sucesso.' }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { person: true },
    })

    if (!user || !user.password) {
      throw new UnauthorizedException('Usuário inválido')
    }

    if (!user.active) {
      throw new UnauthorizedException('Conta não ativada')
    }

    if (!user.person) {
      throw new UnauthorizedException('Usuário sem identidade operacional')
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      throw new UnauthorizedException('Senha inválida')
    }

    const result = this.generateToken(user)

    void this.analytics.track({
      orgId: user.orgId,
      userId: user.id,
      event: UsageMetricEvent.LOGIN,
      metadata: { role: user.role },
    })

    return result
  }
}
