import { Body, Controller, Post } from '@nestjs/common'
import { AuthService } from './auth.service'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
  ) {
    return this.auth.login(body.email, body.password)
  }

  @Post('invite')
  async invite(
    @Body()
    body: {
      email: string
    },
  ) {
    return this.auth.inviteCollaborator(body.email)
  }

  @Post('activate')
  async activate(
    @Body()
    body: {
      token: string
      password: string
    },
  ) {
    return this.auth.activateAccount(
      body.token,
      body.password,
    )
  }
}
