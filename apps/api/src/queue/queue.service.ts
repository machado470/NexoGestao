import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { Job, JobsOptions, Queue, QueueOptions, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'
import { PrismaService } from '../prisma/prisma.service'
import { QUEUE_CONNECTION, QUEUE_DEFAULT_JOB_OPTIONS, QUEUE_NAMES, QueueName } from './queue.constants'

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name)
  private readonly queueMap = new Map<QueueName, Queue>()
  private readonly queueEventsMap = new Map<QueueName, QueueEvents>()

  constructor(
    @Inject(QUEUE_CONNECTION)
    private readonly connection: IORedis,
    private readonly prisma: PrismaService,
  ) {
    this.registerQueues()
  }

  private registerQueues() {
    for (const queueName of Object.values(QUEUE_NAMES)) {
      const opts: QueueOptions = {
        connection: this.connection,
        defaultJobOptions: QUEUE_DEFAULT_JOB_OPTIONS,
      }
      const queue = new Queue(queueName, opts)
      const events = new QueueEvents(queueName, { connection: this.connection })

      this.queueMap.set(queueName, queue)
      this.queueEventsMap.set(queueName, events)
    }
  }

  getQueue(queueName: QueueName) {
    const queue = this.queueMap.get(queueName)
    if (!queue) throw new Error(`Queue not registered: ${queueName}`)
    return queue
  }

  async addJob<T = Record<string, any>>(
    queueName: QueueName,
    name: string,
    payload: T,
    options?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName)
    const job = await queue.add(name, payload, {
      ...QUEUE_DEFAULT_JOB_OPTIONS,
      ...options,
    })

    await this.prisma.queueJob.create({
      data: {
        queue: queueName,
        jobId: job.id?.toString() ?? '',
        status: 'QUEUED',
        payload: payload as any,
      },
    })

    return job
  }

  async updateJobStatus(input: {
    queue: QueueName
    jobId: string
    status: string
    error?: string | null
    completed?: boolean
  }) {
    await this.prisma.queueJob.updateMany({
      where: { queue: input.queue, jobId: input.jobId },
      data: {
        status: input.status,
        error: input.error ?? null,
        completedAt: input.completed ? new Date() : null,
      },
    })
  }

  async getQueueStatus() {
    const result: Record<string, any> = {}

    for (const queueName of Object.values(QUEUE_NAMES)) {
      const queue = this.getQueue(queueName)
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      )
      result[queueName] = counts
    }

    return result
  }

  async onModuleDestroy() {
    for (const events of this.queueEventsMap.values()) {
      await events.close()
    }
    for (const queue of this.queueMap.values()) {
      await queue.close()
    }

    this.logger.log('Queues closed')
  }
}
