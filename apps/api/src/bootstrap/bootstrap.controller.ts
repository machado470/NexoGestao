import { Body, Controller, Headers, Post } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'
import { BootstrapService } from './bootstrap.service'

@Controller('bootstrap')
export class BootstrapController {
  constructor(private readonly service: BootstrapService) {}

  @Public()
  @Post('first-admin')
  async createFirstAdmin(
    @Body()
    body: {
      orgName: string
      adminName: string
      email: string
      password: string
      organizationId?: string
    },
    @Headers('x-bootstrap-secret') bootstrapSecret?: string,
  ) {
    return this.service.createFirstAdmin(body, bootstrapSecret)
  }
}
