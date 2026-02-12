import { Controller, Get } from '@nestjs/common'
import { AuditService } from './audit.service'

@Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  async list() {
    const events = await this.audit.listLatest()

    return {
      success: true,
      data: events,
    }
  }
}
