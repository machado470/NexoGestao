import { Module } from '@nestjs/common'
import { WhatsAppService } from './whatsapp.service'
import { WhatsAppDispatcherJob } from './whatsapp.dispatcher.job'
import { WhatsAppTestController } from './whatsapp.test.controller'
import { WhatsAppController } from './whatsapp.controller'

const testControllers =
  process.env.NODE_ENV === 'production' ? [] : [WhatsAppTestController]

@Module({
  controllers: [...testControllers, WhatsAppController],
  providers: [WhatsAppService, WhatsAppDispatcherJob],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
