import { Controller, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'
import { DemoService } from './demo.service'

@Controller('demo')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Post('bootstrap/live')
  @Roles('ADMIN', 'MANAGER')
  async bootstrapLive(@Org() orgId: string, @User() user: any) {
    const actorUserId = user?.userId ?? user?.sub ?? null
    const actorPersonId = user?.personId ?? null

    const data = await this.demo.bootstrapLiveEnvironment({
      orgId,
      actorUserId,
      actorPersonId,
    })

    return { ok: true, data }
  }
}
