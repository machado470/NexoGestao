// apps/api/src/whatsapp/whatsapp.module.ts

import { Module } from '@nestjs/common'
import { WhatsAppService } from './whatsapp.service'
import { WhatsAppDispatcherJob } from './whatsapp.dispatcher.job'
import { WhatsAppTestController } from './whatsapp.test.controller'

@Module({
  controllers: [WhatsAppTestController],
  providers: [WhatsAppService, WhatsAppDispatcherJob],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
