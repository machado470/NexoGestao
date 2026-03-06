import { Body, Controller, Post, Get, UseGuards, Request, Res } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { Public } from './decorators/public.decorator'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
  ) {
    return this.auth.login(body.email, body.password)
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Request() req) {}

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Request() req, @Res() res) {
    const result = await this.auth.validateGoogleUser(req.user)
    // Redirecionar para o frontend com o token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    return res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`)
  }



  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    return this.auth.forgotPassword(body.email)
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.auth.resetPassword(body.token, body.password)
  }

  @Public()
  @Post('logout')
  async logout() {
    return { success: true }
  }
}
