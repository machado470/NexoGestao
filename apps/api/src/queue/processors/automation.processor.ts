import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { AutomationService } from '../../automation/automation.service'
import { QUEUE_CONNECTION, QUEUE_NAMES } from '../queue.constants'
import { QueueService } from '../queue.service'

@Injectable()
export class AutomationProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationProcessor.name)
  private worker?: Worker

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: IORedis,
    private readonly automationService: AutomationService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.AUTOMATION,
      async (job: Job<any>) => {
        await this.queueService.updateJobStatus({
          queue: QUEUE_NAMES.AUTOMATION,
          jobId: job.id?.toString() ?? '',
          status: 'ACTIVE',
        })

        if (job.name === 'execute-action') {
          await this.automationService.executeActionJob(job.data)
        }

        await this.queueService.updateJobStatus({
          queue: QUEUE_NAMES.AUTOMATION,
          jobId: job.id?.toString() ?? '',
          status: 'COMPLETED',
          completed: true,
        })
      },
      { connection: this.connection },
    )

    this.worker.on('failed', async (job, err) => {
      if (!job) return
      this.logger.error(`automation job failed id=${job.id} error=${err.message}`)
      await this.queueService.updateJobStatus({
        queue: QUEUE_NAMES.AUTOMATION,
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
