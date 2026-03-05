import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { AdminGuard } from './guards/admin.guard'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
  ) {
    return this.auth.login(body.email, body.password)
  }



  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    // Implementação mockada para integração
    return { success: true, message: 'Se o e-mail existir, um link de recuperação será enviado.' }
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    // Implementação mockada para integração
    return { success: true, message: 'Senha redefinida com sucesso.' }
  }

  @Post('logout')
  async logout() {
    return { success: true }
  }
}
