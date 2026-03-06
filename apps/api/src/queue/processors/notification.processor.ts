import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { NotificationsService } from '../../notifications/notifications.service'
import { QUEUE_CONNECTION, QUEUE_NAMES } from '../queue.constants'
import { QueueService } from '../queue.service'

@Injectable()
export class NotificationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationProcessor.name)
  private worker?: Worker

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: IORedis,
    private readonly notificationsService: NotificationsService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.NOTIFICATIONS,
      async (job: Job<any>) => {
        await this.queueService.updateJobStatus({
          queue: QUEUE_NAMES.NOTIFICATIONS,
          jobId: job.id?.toString() ?? '',
          status: 'ACTIVE',
        })

        await this.notificationsService.createNotificationNow(
          job.data.orgId,
          job.data.type,
          job.data.message,
          job.data.userId,
          job.data.metadata,
        )

        await this.queueService.updateJobStatus({
          queue: QUEUE_NAMES.NOTIFICATIONS,
          jobId: job.id?.toString() ?? '',
          status: 'COMPLETED',
          completed: true,
        })
      },
      { connection: this.connection },
    )

    this.worker.on('failed', async (job, err) => {
      if (!job) return
      this.logger.error(`notification job failed id=${job.id} error=${err.message}`)
      await this.queueService.updateJobStatus({
        queue: QUEUE_NAMES.NOTIFICATIONS,
        jobId: job.id?.toString() ?? '',
        status: 'FAILED',
        error: err.message,
      })
    })
  }

  async onModuleDestroy() {
    await this.worker?.close()
  }
}
