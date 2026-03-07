import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { TimelineService } from './timeline.service'
import { TimelineController } from './timeline.controller'
import { WebhookModule } from '../webhooks/webhook.module'
import { RequestContextService } from '../common/context/request-context.service'

@Module({
  imports: [PrismaModule, WebhookModule],
  controllers: [TimelineController],
  providers: [
    TimelineService,
    RequestContextService
  ],
  exports: [TimelineService],
})
export class TimelineModule {}
