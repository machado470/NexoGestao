import { Injectable, NestMiddleware, Logger } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP')

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req
    const userAgent = req.get('user-agent') || ''
    const startTime = Date.now()

    // ✅ Gera ou propaga requestId para rastreabilidade
    const requestId = (req.headers['x-request-id'] as string) || randomUUID()
    ;(req as any).requestId = requestId
    res.setHeader('X-Request-ID', requestId)

    res.on('finish', () => {
      const { statusCode } = res
      const contentLength = res.get('content-length') || '0'
      const duration = Date.now() - startTime

      // ✅ Extrai orgId e userId do token JWT (se já decodificado pelo guard)
      const user = (req as any).user
      const orgId = user?.orgId ?? (req.headers['x-org-id'] as string) ?? undefined
      const userId = user?.userId ?? user?.sub ?? undefined

      const logData = {
        requestId,
        method,
        url: originalUrl,
        statusCode,
        contentLength,
        duration: `${duration}ms`,
        ip,
        userAgent,
        orgId,
        userId,
      }

      if (statusCode >= 500) {
        this.logger.error(
          `${method} ${originalUrl} ${statusCode} ${duration}ms [${requestId}]`,
          JSON.stringify(logData),
        )
      } else if (statusCode >= 400) {
        this.logger.warn(
          `${method} ${originalUrl} ${statusCode} ${duration}ms [${requestId}]`,
          JSON.stringify(logData),
        )
      } else {
        this.logger.log(
          `${method} ${originalUrl} ${statusCode} ${duration}ms [${requestId}]`,
        )
      }
    })

    next()
  }
}
