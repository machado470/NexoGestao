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
    try {
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

      this.logger.log('Automation worker iniciado')
    } catch (err) {
      const error = err as Error
      this.logger.error(`Falha ao iniciar automation worker: ${error.message}`)
    }
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close()
    } catch (err) {
      const error = err as Error
      this.logger.error(`Erro ao fechar automation worker: ${error.message}`)
    }
  }
}
