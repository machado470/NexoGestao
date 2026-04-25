import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { WhatsAppService } from './whatsapp.service'
import { WhatsAppDispatcherJob } from './whatsapp.dispatcher.job'
import { WhatsAppTestController } from './whatsapp.test.controller'
import { WhatsAppController } from './whatsapp.controller'
import { QueueModule } from '../queue/queue.module'
import { WhatsAppProcessor } from '../queue/processors/whatsapp.processor'
import { TimelineModule } from '../timeline/timeline.module'
import { QuotasModule } from '../quotas/quotas.module'
import { WhatsAppTemplateService } from './whatsapp-template.service'
import { WhatsAppContextService } from './whatsapp-context.service'
import { WhatsAppAutomationService } from './whatsapp-automation.service'

const testControllers = process.env.NODE_ENV === 'production' ? [] : [WhatsAppTestController]

@Module({
  imports: [PrismaModule, QueueModule, TimelineModule, QuotasModule],
  controllers: [...testControllers, WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppTemplateService,
    WhatsAppContextService,
    WhatsAppAutomationService,
    WhatsAppDispatcherJob,
    WhatsAppProcessor,
  ],
  exports: [WhatsAppService, WhatsAppTemplateService, WhatsAppContextService, WhatsAppAutomationService],
})
export class WhatsAppModule {}
