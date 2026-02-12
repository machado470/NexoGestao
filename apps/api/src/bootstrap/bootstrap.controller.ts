import { Body, Controller, Post } from '@nestjs/common'
import { BootstrapService } from './bootstrap.service'

@Controller('bootstrap')
export class BootstrapController {
  constructor(private readonly service: BootstrapService) {}

  @Post('first-admin')
  async createFirstAdmin(
    @Body()
    body: {
      orgName: string
      adminName: string
      email: string
      password: string
    },
  ) {
    return this.service.createFirstAdmin(body)
  }
}
