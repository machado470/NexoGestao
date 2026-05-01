import { Module } from '@nestjs/common'
import { BullBoardModule } from '@bull-board/nestjs'
import { ExpressAdapter } from '@bull-board/express'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { QueueService } from './queue.service'
import { QUEUE_NAMES } from './queue.constants'

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature(
      { name: QUEUE_NAMES.WHATSAPP, adapter: BullMQAdapter },
      { name: QUEUE_NAMES.WHATSAPP_DLQ, adapter: BullMQAdapter },
    ),
  ],
  providers: [QueueService],
})
export class QueueBoardModule {}
