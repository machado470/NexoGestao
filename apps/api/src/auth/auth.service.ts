import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { createHash } from 'crypto'
import { Resend } from 'resend'
import { v4 as uuidv4 } from 'uuid'

import { AnalyticsService, UsageMetricEvent } from '../analytics/analytics.service'
import { PrismaService } from '../prisma/prisma.service'
import { BCRYPT_ROUNDS, compareSecretOrDummy, dummyBcryptHash } from './password-hashing'

/**
 * Single answer for an unknown e-mail, an account without password (pending invite, Google-only)
 * and a wrong password. Account state is only disclosed after the password was proven.
 */
export const INVALID_CREDENTIALS_MESSAGE = 'Credenciais inválidas'
export const INVALID_CREDENTIALS_CODE = 'INVALID_CREDENTIALS'

/**
 * Minimum response time of the account-specific e-mail routes (forgot-password and
 * resend-email-verification). The e-mail is still sent before answering; the floor only makes
 * "no account" answer as late as "account + delivery" whenever the provider is faster than it.
 */
export const AUTH_EMAIL_RESPONSE_FLOOR_DEFAULT_MS = 1_000
/** Kept well below the BFF upstream timeout (12 s) so a slow provider still fits. */
export const AUTH_EMAIL_RESPONSE_FLOOR_MAX_MS = 5_000

/** Accepts an integer number of milliseconds in [0, MAX]; anything else fails the boot. */
export function readAuthEmailResponseFloorMs(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return AUTH_EMAIL_RESPONSE_FLOOR_DEFAULT_MS
  const value = raw.trim()
  if (!/^\d{1,5}$/.test(value) || Number(value) > AUTH_EMAIL_RESPONSE_FLOOR_MAX_MS) {
    throw new Error(`AUTH_EMAIL_RESPONSE_FLOOR_MS must be an integer between 0 and ${AUTH_EMAIL_RESPONSE_FLOOR_MAX_MS}`)
  }
  return Number(value)
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name)
  private readonly resend: Resend | null = null
  private readonly enforceEmailVerification: boolean
  private readonly emailVerificationBypass = new Set<string>()
  private readonly emailResponseFloorMs: number

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
        '[OPTIONAL][integration-missing-config] RESEND_API_KEY ausente. Recuperação por e-mail ficará desabilitada.',
      )
    }

    this.emailResponseFloorMs = readAuthEmailResponseFloorMs(
      this.config.get<string>('AUTH_EMAIL_RESPONSE_FLOOR_MS'),
    )

    this.enforceEmailVerification = this.parseBooleanEnv(
      this.config.get<string>('AUTH_ENFORCE_EMAIL_VERIFICATION'),
      false,
    )

    const bypassEmailsRaw = this.config.get<string>(
      'AUTH_EMAIL_VERIFICATION_BYPASS_EMAILS',
    )

    if (bypassEmailsRaw) {
      for (const email of bypassEmailsRaw.split(',')) {
        const normalized = email.trim().toLowerCase()
        if (normalized) {
          this.emailVerificationBypass.add(normalized)
        }
      }
    }
  }

  private parseBooleanEnv(value: string | undefined, fallback: boolean) {
    if (typeof value !== 'string') return fallback
    const normalized = value.trim().toLowerCase()
    if (!normalized) return fallback
    return ['1', 'true', 'yes', 'y', 'on'].includes(normalized)
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

  private hashToken(rawToken: string) {
    return createHash('sha256').update(rawToken).digest('hex')
  }

  createSessionPayload(user: any) {
    const token = this.jwt.sign({
      sub: user.id,
      sessionVersion: user.sessionVersion ?? 0,
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
    const orgName = typeof params?.orgName === 'string' ? params.orgName.trim() : ''
    const adminName = typeof params?.adminName === 'string' ? params.adminName.trim() : ''
    const email = typeof params?.email === 'string' ? params.email.trim().toLowerCase() : ''
    const password = typeof params?.password === 'string' ? params.password : ''

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

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
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
          emailVerifiedAt: null,
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

    let verificationEmailStatus: 'sent' | 'failed' | 'provider_unavailable' =
      'provider_unavailable'

    try {
      verificationEmailStatus = await this.sendVerificationEmail(createdUser.id, email)
    } catch (error) {
      verificationEmailStatus = 'failed'
      this.logger.warn(
        `Falha ao enviar verificação de e-mail: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }

    const canAutoLogin = !this.enforceEmailVerification
    const sessionPayload = canAutoLogin
      ? this.createSessionPayload(createdUser)
      : undefined

    const verificationMessageByStatus = {
      sent: 'Enviamos um link de confirmação para seu e-mail. Verifique sua caixa de entrada para liberar o login.',
      failed:
        'Conta criada, mas houve falha ao enviar o e-mail de confirmação. Use o login para solicitar um novo link.',
      provider_unavailable:
        'Conta criada. Este ambiente está sem provedor de e-mail; no login você poderá solicitar novo link quando o serviço estiver ativo.',
    } as const

    return {
      success: true,
      message: canAutoLogin
        ? 'Conta criada com sucesso.'
        : verificationMessageByStatus[verificationEmailStatus],
      requiresEmailVerification: true,
      emailVerificationStatus: verificationEmailStatus,
      rollout: {
        emailVerificationEnforced: this.enforceEmailVerification,
        canAutoLogin,
      },
      ...(sessionPayload ? sessionPayload : {}),
    }
  }

  async validateGoogleUser(googleUser: any) {
    const email = (googleUser?.email ?? '').trim().toLowerCase()

    if (!email || googleUser?.emailVerified !== true) {
      throw new UnauthorizedException('Usuário Google inválido')
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { person: true },
    })

    if (!user) {
      throw new UnauthorizedException(
        'Nenhuma conta encontrada para este e-mail. Solicite acesso ao administrador.',
      )
    }

    if (!user.active) {
      throw new UnauthorizedException('Conta não ativada')
    }

    if (!user.person || !user.person.active) {
      throw new UnauthorizedException('Usuário sem identidade operacional ativa')
    }

    return this.createSessionPayload(user)
  }

  async forgotPassword(email: string) {
    const normalizedEmail = (typeof email === 'string' ? email : '').trim().toLowerCase()

    if (!normalizedEmail) {
      throw new BadRequestException('Email é obrigatório')
    }

    // Availability is global: check it before looking up an account so this
    // failure cannot distinguish registered from unregistered email addresses.
    this.ensureEmailAvailable()
    const startedAt = performance.now()
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (user) {
      try {
        // Sent before answering, as before C7.2b: a crash or restart never acknowledges an
        // e-mail that was not attempted.
        await this.sendPasswordReset(user.id, normalizedEmail)
      } catch {
        // A per-recipient/provider failure is observable internally, but public
        // recovery responses must not disclose whether an account exists.
        this.logger.error('[auth-email] password_reset_delivery_failed')
      }
    }
    await this.waitForEmailResponseFloor(startedAt)
    return this.emailRequestAcknowledgement()
  }

  private async sendPasswordReset(userId: string, normalizedEmail: string) {
    const rawToken = uuidv4()
    const tokenHash = this.hashToken(rawToken)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3010'
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: tokenHash,
        resetTokenExpiresAt: expiresAt,
      },
    })
    await this.deliverAuthEmail({
      from: this.config.get<string>('EMAIL_FROM') || 'onboarding@resend.dev',
      to: normalizedEmail,
      subject: 'Recuperação de Senha - NexoGestao',
      html: `<p>Você solicitou a recuperação de senha. Clique no link abaixo para redefinir:</p><a href="${resetLink}">${resetLink}</a><p>Este link expira em 1 hora.</p>`,
    })
  }

  /**
   * Pads the answer to the configured floor, measured from the account lookup. Requests that
   * already took longer (slow provider) are not delayed further.
   */
  private async waitForEmailResponseFloor(startedAt: number) {
    const remaining = this.emailResponseFloorMs - (performance.now() - startedAt)
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining))
  }

  onModuleInit() {
    // Prepare the dummy hash at boot so no request pays for creating it.
    void dummyBcryptHash().catch(() => this.logger.warn('[auth] dummy_hash_warmup_failed'))
  }

  async resetPassword(token: string, password: string) {
    const normalizedToken = (typeof token === 'string' ? token : '').trim()

    if (!normalizedToken) {
      throw new BadRequestException('Token é obrigatório')
    }

    if (!password || password.length < 8) {
      throw new BadRequestException('A senha precisa ter ao menos 8 caracteres')
    }

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: this.hashToken(normalizedToken),
        resetTokenExpiresAt: {
          gt: new Date(),
        },
      },
    })

    if (!user) {
      throw new UnauthorizedException('Token inválido ou expirado')
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS)

    const updated = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        resetToken: this.hashToken(normalizedToken),
        resetTokenExpiresAt: { gt: new Date() },
      },
      data: {
        password: hashedPassword,
        sessionVersion: { increment: 1 },
        resetToken: null,
        resetTokenExpiresAt: null,
      },
    })
    if (updated.count !== 1) {
      throw new UnauthorizedException('Token inválido ou expirado')
    }

    return {
      success: true,
      message: 'Senha redefinida com sucesso.',
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = (typeof email === 'string' ? email : '').trim().toLowerCase()

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

    // Exactly one bcrypt comparison on every path (dummy hash when there is no usable account).
    const valid = await compareSecretOrDummy(password, user?.password)

    if (!user || !valid) {
      throw new UnauthorizedException({ message: INVALID_CREDENTIALS_MESSAGE, code: INVALID_CREDENTIALS_CODE })
    }

    // From here on the caller proved the password: account state can be explained.
    if (!user.active) {
      throw new UnauthorizedException('Conta não ativada')
    }

    if (!user.person || !user.person.active) {
      throw new UnauthorizedException('Usuário sem identidade operacional ativa')
    }

    const bypassEmailVerification =
      !this.enforceEmailVerification ||
      this.emailVerificationBypass.has(normalizedEmail)

    if (!user.emailVerifiedAt && !bypassEmailVerification) {
      throw new UnauthorizedException({
        message:
          'E-mail ainda não verificado. Confirme seu e-mail para concluir o login.',
        code: 'EMAIL_NOT_VERIFIED',
        canResendVerification: true,
        email: normalizedEmail,
      })
    }

    const result = this.createSessionPayload(user)

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
      requiresEmailVerification: !user.emailVerifiedAt,
      emailVerificationBypassApplied:
        !user.emailVerifiedAt && bypassEmailVerification,
      ...result,
    }
  }

  async verifyEmail(rawToken: string) {
    const token = (rawToken ?? '').trim()
    if (!token) {
      throw new BadRequestException('Token é obrigatório')
    }

    const tokenHash = this.hashToken(token)
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyTokenHash: tokenHash,
        emailVerifyTokenExpiresAt: {
          gt: new Date(),
        },
      },
    })

    if (!user) {
      throw new UnauthorizedException('Token inválido ou expirado')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerifyTokenHash: null,
        emailVerifyTokenExpiresAt: null,
      },
    })

    return {
      success: true,
      message: 'E-mail confirmado com sucesso.',
    }
  }

  async resendEmailVerification(email: string) {
    const normalizedEmail = (typeof email === 'string' ? email : '').trim().toLowerCase()
    if (!normalizedEmail) {
      throw new BadRequestException('Email é obrigatório')
    }

    this.ensureEmailAvailable()
    const startedAt = performance.now()
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, emailVerifiedAt: true },
    })
    if (user && !user.emailVerifiedAt) {
      try {
        await this.sendVerificationEmail(user.id, normalizedEmail)
      } catch {
        this.logger.error('[auth-email] verification_delivery_failed')
      }
    }
    await this.waitForEmailResponseFloor(startedAt)
    return this.emailRequestAcknowledgement()
  }

  private ensureEmailAvailable() {
    if (!this.resend) throw new ServiceUnavailableException('Serviço de e-mail indisponível no momento. Tente novamente mais tarde.')
  }

  private emailRequestAcknowledgement() {
    return { success: true, message: 'Solicitação recebida. Verifique seu e-mail e a pasta de spam. Se o link não chegar, tente novamente mais tarde.' }
  }

  private async deliverAuthEmail(input: Parameters<Resend['emails']['send']>[0]) {
    this.ensureEmailAvailable()
    try {
      const result = await this.resend!.emails.send(input)
      if (result.error || !result.data?.id) throw new Error('delivery_rejected')
    } catch {
      // Never log provider response bodies or exception text: they may contain
      // recipients, links or credentials. Callers record a bounded reason code.
      throw new ServiceUnavailableException('Não foi possível enviar o e-mail no momento.')
    }
  }

  async sendVerificationEmail(userId: string, email: string): Promise<'sent' | 'provider_unavailable'> {
    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY ausente. Verificação de e-mail não enviada para ${email}.`,
      )
      return 'provider_unavailable'
    }

    const rawToken = uuidv4()
    const tokenHash = this.hashToken(rawToken)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifyTokenHash: tokenHash,
        emailVerifyTokenExpiresAt: expiresAt,
      },
    })

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3010'
    const verifyLink = `${frontendUrl}/auth/confirm-email?token=${rawToken}`

    await this.deliverAuthEmail({
      from: this.config.get<string>('EMAIL_FROM') || 'onboarding@resend.dev',
      to: email,
      subject: 'Confirme seu e-mail - NexoGestao',
      html: `<p>Confirme seu e-mail para proteger sua conta:</p><a href="${verifyLink}">${verifyLink}</a><p>Este link expira em 24 horas.</p>`,
    })
    return 'sent'
  }
}
