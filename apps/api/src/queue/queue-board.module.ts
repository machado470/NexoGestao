import { Injectable, Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import type { Request, Response, NextFunction } from 'express'
import { QueueModule } from './queue.module'
import { QUEUE_NAMES } from './queue.constants'
import { QueueService } from './queue.service'

const BOARD_ROUTE = '/admin/queues'
const BOARD_BASE_PATH = `/v1${BOARD_ROUTE}`

@Injectable()
class QueueBoardMiddleware {
  private readonly logger = new Logger(QueueBoardMiddleware.name)
  private readonly adapter = new ExpressAdapter()
  private readonly board: ReturnType<typeof createBullBoard>
  private queuesRegistered = false
  private warnedDegraded = false

  constructor(private readonly queueService: QueueService) {
    this.adapter.setBasePath(BOARD_BASE_PATH)
    this.board = createBullBoard({
      queues: [],
      serverAdapter: this.adapter,
    })
  }

  use(req: Request, res: Response, next: NextFunction) {
    this.registerQueuesIfAvailable()
    return this.adapter.getRouter()(req, res, next)
  }

  private registerQueuesIfAvailable() {
    if (this.queuesRegistered) return

    if (!this.queueService.isEnabled()) {
      if (!this.warnedDegraded) {
        this.warnedDegraded = true
        this.logger.warn('Bull Board montado sem filas: Redis/fila em modo degradado')
      }
      return
    }

    for (const queueName of [QUEUE_NAMES.WHATSAPP, QUEUE_NAMES.WHATSAPP_DLQ]) {
      this.board.addQueue(new BullMQAdapter(this.queueService.getQueue(queueName)))
    }

    this.queuesRegistered = true
    this.logger.log(`Bull Board montado em ${BOARD_BASE_PATH} usando QueueService singleton`)
  }
}

@Module({
  imports: [QueueModule],
  providers: [QueueBoardMiddleware],
})
export class QueueBoardModule implements NestModule {
  constructor(private readonly queueBoardMiddleware: QueueBoardMiddleware) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: Request, res: Response, next: NextFunction) =>
        this.queueBoardMiddleware.use(req, res, next),
      )
      .forRoutes(BOARD_ROUTE)
  }
}
