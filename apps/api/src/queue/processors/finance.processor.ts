import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { FinanceService } from '../../finance/finance.service'
import { QUEUE_CONNECTION, QUEUE_NAMES } from '../queue.constants'
import { QueueService } from '../queue.service'

@Injectable()
export class FinanceProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FinanceProcessor.name)
  private worker?: Worker

  constructor(
    @Inject(QUEUE_CONNECTION) private readonly connection: IORedis,
    private readonly financeService: FinanceService,
    private readonly queueService: QueueService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.FINANCE,
      async (job: Job<any>) => {
        await this.queueService.updateJobStatus({
          queue: QUEUE_NAMES.FINANCE,
          jobId: job.id?.toString() ?? '',
          status: 'ACTIVE',
        })

        if (job.name === 'create-charge') {
          await this.financeService.createAutomationCharge(job.data)
        }

        if (job.name === 'payment-reminder') {
          await this.financeService.sendPaymentReminder(job.data)
        }

        await this.queueService.updateJobStatus({
          queue: QUEUE_NAMES.FINANCE,
          jobId: job.id?.toString() ?? '',
          status: 'COMPLETED',
          completed: true,
        })
      },
      { connection: this.connection },
    )

    this.worker.on('failed', async (job, err) => {
      if (!job) return
      this.logger.error(`finance job failed id=${job.id} error=${err.message}`)
      await this.queueService.updateJobStatus({
        queue: QUEUE_NAMES.FINANCE,
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
