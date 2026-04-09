import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AuthGuard } from '@nestjs/passport'
import { Throttle } from '@nestjs/throttler'

import { AuthService } from './auth.service'
import { Public } from './decorators/public.decorator'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private ensureGoogleOAuthEnabled() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim()
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim()
    const redirectUrl = this.config.get<string>('GOOGLE_REDIRECT_URL')?.trim()

    if (!clientId || !clientSecret || !redirectUrl) {
      throw new ServiceUnavailableException(
        'Login com Google não está configurado neste ambiente.',
      )
    }
  }

  private readSafeRedirect(redirect: unknown) {
    if (typeof redirect !== 'string') return null
    const value = redirect.trim()
    if (!value.startsWith('/')) return null
    if (value.startsWith('//')) return null
    if (value.startsWith('/login')) return null
    if (value.startsWith('/register')) return null
    if (value.startsWith('/forgot-password')) return null
    if (value.startsWith('/reset-password')) return null
    return value
  }

  private decodeOAuthState(state: unknown): { redirect: string } | null {
    if (typeof state !== 'string' || !state.trim()) return null
    try {
      const parsed = JSON.parse(
        Buffer.from(state.trim(), 'base64url').toString('utf8'),
      ) as { redirect?: unknown }

      const redirect = this.readSafeRedirect(parsed?.redirect)
      if (!redirect) return null
      return { redirect }
    } catch {
      return null
    }
  }

  @Public()
  @Post('register')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async register(
    @Body()
    body: {
      orgName: string
      adminName: string
      email: string
      password: string
    },
  ) {
    return this.auth.register(body)
  }

  @Public()
  @Post('login')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body.email, body.password)
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Request() _req: any) {
    this.ensureGoogleOAuthEnabled()
    return
  }

  @Public()
  @Post('google/bff-login')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  async googleBffLogin(
    @Body()
    body: {
      email: string
      firstName?: string
      lastName?: string
      picture?: string
      sub?: string
      emailVerified?: boolean
    },
  ) {
    return this.auth.loginWithGoogleProfile(body)
  }

  @Public()
  @Get('google/status')
  googleStatus() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim()
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim()
    const redirectUrl = this.config.get<string>('GOOGLE_REDIRECT_URL')?.trim()
    const configured = Boolean(clientId && clientSecret && redirectUrl)

    return {
      configured,
      status: configured ? 'configured' : 'missing',
      missing: {
        clientId: !clientId,
        clientSecret: !clientSecret,
        redirectUrl: !redirectUrl,
      },
      message: configured
        ? 'Google OAuth configurado.'
        : 'Google OAuth não configurado neste ambiente.',
    }
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req: any, @Res() res: any) {
    this.ensureGoogleOAuthEnabled()
    const result = await this.auth.validateGoogleUser(req.user)
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3010'
    const callbackUrl = new URL('/auth/callback', frontendUrl)
    callbackUrl.searchParams.set('token', result.token)

    const decodedState = this.decodeOAuthState(req.query?.state)
    if (decodedState?.redirect) {
      callbackUrl.searchParams.set('redirect', decodedState.redirect)
    }

    return res.redirect(callbackUrl.toString())
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async forgotPassword(@Body() body: { email: string }) {
    return this.auth.forgotPassword(body.email)
  }

  @Public()
  @Post('reset-password')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.auth.resetPassword(body.token, body.password)
  }

  @Public()
  @Post('verify-email')
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  async verifyEmail(@Body() body: { token: string }) {
    return this.auth.verifyEmail(body.token)
  }

  @Public()
  @Post('resend-email-verification')
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async resendEmailVerification(@Body() body: { email: string }) {
    return this.auth.resendEmailVerification(body.email)
  }
}
