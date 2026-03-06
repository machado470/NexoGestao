import { Controller, Get } from '@nestjs/common'
import { QueueService } from './queue.service'

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('status')
  async status() {
    const queues = await this.queueService.getQueueStatus()
    return { queues }
  }
}
