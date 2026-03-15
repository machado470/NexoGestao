import { Body, Controller, Get, Post, Request, Res, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Throttle } from '@nestjs/throttler'

import { AuthService } from './auth.service'
import { Public } from './decorators/public.decorator'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
    return
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req: any, @Res() res: any) {
    const result = await this.auth.validateGoogleUser(req.user)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    return res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`)
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
  @Post('logout')
  async logout() {
    return {
      success: true,
      message: 'Logout efetuado com sucesso.',
    }
  }
}
