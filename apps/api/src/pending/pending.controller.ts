import { Controller, Get, Param } from '@nestjs/common'
import { PendingService } from './pending.service'

@Controller('pending')
export class PendingController {
  constructor(
    private readonly service: PendingService,
  ) {}

  // ADMIN / ORG
  @Get(':orgId')
  list(@Param('orgId') orgId: string) {
    return this.service.listByOrg(orgId)
  }
}
