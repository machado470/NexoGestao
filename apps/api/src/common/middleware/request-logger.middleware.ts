import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {

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

      const user = (req as any).user
      const orgId = user?.orgId ?? (req.headers['x-org-id'] as string) ?? null
      const userId = user?.userId ?? user?.sub ?? null

      const logData = {
        event: 'http_request',
        requestId,
        userId,
        orgId,
        route: `${method} ${originalUrl}`,
        status: statusCode,
        latencyMs: duration,
        contentLength,
        ip,
        userAgent,
      }

      const line = JSON.stringify(logData)
      if (statusCode >= 500) {
        console.error(line)
      } else if (statusCode >= 400) {
        console.warn(line)
      } else {
        console.log(line)
      }
    })

    next()
  }
}
