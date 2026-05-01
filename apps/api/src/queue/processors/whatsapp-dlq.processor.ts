import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { QUEUE_CONNECTION, QUEUE_NAMES } from '../queue.constants'

@Injectable()
export class WhatsAppDlqProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppDlqProcessor.name)
  private worker?: Worker

  constructor(@Inject(QUEUE_CONNECTION) private readonly connection: IORedis) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUE_NAMES.WHATSAPP_DLQ,
      async (job: Job<any>) => {
        this.logger.error(
          `DLQ whatsapp payload=${JSON.stringify(job.data?.payload ?? {})} error=${job.data?.error ?? 'unknown'} attemptsMade=${job.data?.attemptsMade ?? 0} requestId=${job.data?.requestId ?? 'n/a'} userId=${job.data?.userId ?? 'n/a'} orgId=${job.data?.orgId ?? 'n/a'}`,
        )
      },
      {
        connection: this.connection,
        concurrency: 2,
      },
    )
  }

  async onModuleDestroy() {
    await this.worker?.close()
  }
}
