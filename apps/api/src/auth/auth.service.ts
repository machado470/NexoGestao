import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { Resend } from 'resend'
import { v4 as uuidv4 } from 'uuid'

import { AnalyticsService, UsageMetricEvent } from '../analytics/analytics.service'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly resend: Resend | null = null

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

  private slugify(input: string) {
    const s = (input ?? '').trim().toLowerCase()

    const normalized = s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')

    return normalized || 'org'
  }

  private async uniqueOrgSlug(base: string) {
    let slug = base
    let i = 0

    while (true) {
      const exists = await this.prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      })

      if (!exists) return slug

      i++
      slug = `${base}-${i}`
    }
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

  async register(params: {
    orgName: string
    adminName: string
    email: string
    password: string
  }) {
    const orgName = (params.orgName ?? '').trim()
    const adminName = (params.adminName ?? '').trim()
    const email = (params.email ?? '').trim().toLowerCase()
    const password = params.password ?? ''

    if (!orgName) {
      throw new BadRequestException('Nome da empresa é obrigatório')
    }

    if (!adminName) {
      throw new BadRequestException('Nome do administrador é obrigatório')
    }

    if (!email) {
      throw new BadRequestException('Email é obrigatório')
    }

    if (password.length < 8) {
      throw new BadRequestException('A senha precisa ter ao menos 8 caracteres')
    }

    const emailInUse = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (emailInUse) {
      throw new ConflictException('Email já cadastrado')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const baseSlug = this.slugify(orgName)
    const slug = await this.uniqueOrgSlug(baseSlug)

    const createdUser = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          requiresOnboarding: true,
        },
      })

      return tx.user.create({
        data: {
          email,
          password: passwordHash,
          role: 'ADMIN',
          active: true,
          orgId: org.id,
          person: {
            create: {
              name: adminName,
              email,
              role: 'ADMIN',
              active: true,
              orgId: org.id,
            },
          },
        },
        include: {
          person: true,
        },
      })
    })

    return {
      success: true,
      message: 'Conta criada com sucesso.',
      ...this.generateToken(createdUser),
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
              active: true,
              orgId: org.id,
            },
          },
        },
        include: { person: true },
      })
    }

    return this.generateToken(user)
  }

  async forgotPassword(email: string) {
    const normalizedEmail = (email ?? '').trim().toLowerCase()

    if (!normalizedEmail) {
      throw new BadRequestException('Email é obrigatório')
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (!user) {
      return {
        success: true,
        message: 'Se o e-mail existir, um link de recuperação será enviado.',
      }
    }

    if (!this.resend) {
      throw new ServiceUnavailableException(
        'Recuperação de senha por e-mail não está disponível no momento.',
      )
    }

    const token = uuidv4()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3001'
    const resetLink = `${frontendUrl}/reset-password?token=${token}`

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiresAt: expiresAt,
      },
    })

    try {
      await this.resend.emails.send({
        from: this.config.get<string>('EMAIL_FROM') || 'onboarding@resend.dev',
        to: normalizedEmail,
        subject: 'Recuperação de Senha - NexoGestao',
        html: `<p>Você solicitou a recuperação de senha. Clique no link abaixo para redefinir:</p><a href="${resetLink}">${resetLink}</a><p>Este link expira em 1 hora.</p>`,
      })
    } catch (error) {
      this.logger.error(
        `Erro ao enviar e-mail de recuperação: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )

      throw new ServiceUnavailableException(
        'Não foi possível enviar o e-mail de recuperação no momento.',
      )
    }

    return {
      success: true,
      message: 'Se o e-mail existir, um link de recuperação será enviado.',
    }
  }

  async resetPassword(token: string, password: string) {
    const normalizedToken = (token ?? '').trim()

    if (!normalizedToken) {
      throw new BadRequestException('Token é obrigatório')
    }

    if (!password || password.length < 8) {
      throw new BadRequestException('A senha precisa ter ao menos 8 caracteres')
    }

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: normalizedToken,
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

    return {
      success: true,
      message: 'Senha redefinida com sucesso.',
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = (email ?? '').trim().toLowerCase()

    if (!normalizedEmail) {
      throw new BadRequestException('Email é obrigatório')
    }

    if (!password) {
      throw new BadRequestException('Senha é obrigatória')
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
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

    try {
      const loginEvent = (UsageMetricEvent as any)?.LOGIN ?? 'LOGIN'

      await this.analytics.track({
        orgId: user.orgId,
        userId: user.id,
        event: loginEvent as any,
        metadata: { role: user.role },
      })
    } catch (error) {
      this.logger.warn(
        `Falha ao registrar analytics de login: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    return {
      success: true,
      message: 'Login efetuado com sucesso.',
      ...result,
    }
  }
}
