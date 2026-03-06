import { Module } from '@nestjs/common'
import { WhatsAppService } from './whatsapp.service'
import { WhatsAppDispatcherJob } from './whatsapp.dispatcher.job'
import { WhatsAppTestController } from './whatsapp.test.controller'
import { WhatsAppController } from './whatsapp.controller'
import { QueueModule } from '../queue/queue.module'
import { WhatsAppProcessor } from '../queue/processors/whatsapp.processor'

const testControllers =
  process.env.NODE_ENV === 'production' ? [] : [WhatsAppTestController]

@Module({
  imports: [QueueModule],
  controllers: [...testControllers, WhatsAppController],
  providers: [WhatsAppService, WhatsAppDispatcherJob, WhatsAppProcessor],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
