import { BadRequestException, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { FinanceService } from '../../finance/finance.service'
import { QUEUE_CONNECTION, QUEUE_DEFAULT_WORKER_OPTIONS, QUEUE_NAMES } from '../queue.constants'
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

  async onModuleInit() {
    try {
      this.worker = new Worker(
        QUEUE_NAMES.FINANCE,
        async (job: Job<any>) => this.queueService.processJobWithTracing(
          QUEUE_NAMES.FINANCE, job.name, job.data, () => this.processJob(job),
        ),
        { connection: this.connection, ...QUEUE_DEFAULT_WORKER_OPTIONS },
      )

      this.worker.on('error', (error) => {
        this.logger.error(`Finance worker error: ${error.message}`)
      })

      this.logger.log('Finance worker iniciado')
    } catch (err) {
      const error = err as Error
      this.logger.error(`Falha ao iniciar finance worker: ${error.message}`)
    }
  }

  async processJob(job: Pick<Job<any>, 'id' | 'name' | 'data'>) {
    await this.queueService.updateJobStatus({ queue: QUEUE_NAMES.FINANCE, jobId: job.id?.toString() ?? '', status: 'ACTIVE' })
    let result: unknown
    switch (job.name) {
      case 'create-charge':
        result = await this.financeService.createAutomationCharge(job.data)
        break
      case 'payment-reminder':
        result = await this.financeService.sendPaymentReminder(job.data)
        break
      default:
        throw new BadRequestException('Tipo de job financeiro não suportado.')
    }
    await this.queueService.updateJobStatus({ queue: QUEUE_NAMES.FINANCE, jobId: job.id?.toString() ?? '', status: 'COMPLETED', completed: true })
    return result
  }

  async onModuleDestroy() {
    try {
      await this.worker?.close()
    } catch (err) {
      const error = err as Error
      this.logger.error(`Erro ao fechar finance worker: ${error.message}`)
    }
  }
}
