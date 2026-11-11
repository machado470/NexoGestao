import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { MetricsService } from '../metrics/metrics.service'
import { trace } from '@opentelemetry/api'
import { resolveRequestTracing } from '../context/request-tracing.util'

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  private endpointKey(method: string, originalUrl: string): string {
    // Never use arbitrary incoming paths as metric dimensions.
    return `${method} ${originalUrl || '/:unmatched'}`
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req
    const userAgent = req.get('user-agent') || ''
    const startTime = Date.now()

    // ✅ Gera ou propaga requestId para rastreabilidade
    const { requestId, correlationId } = resolveRequestTracing(req.headers as Record<string, unknown>)
    ;(req as any).requestId = requestId
    ;(req as any).correlationId = correlationId
    res.setHeader('X-Request-ID', requestId)
    res.setHeader('X-Correlation-ID', correlationId)

    res.on('finish', () => {
      const { statusCode } = res
      const contentLength = res.get('content-length') || '0'
      const duration = Date.now() - startTime

      const user = (req as any).user
      const orgId = user?.orgId ?? (req.headers['x-org-id'] as string) ?? null
      const userId = user?.userId ?? user?.sub ?? null

      const activeSpan = trace.getActiveSpan()
      const traceId = activeSpan?.spanContext().traceId ?? null
      const logData = {
        event: 'http_request',
        requestId,
        correlationId,
        userId,
        orgId,
        traceId,
        route: `${method} ${originalUrl}`,
        status: statusCode,
        latencyMs: duration,
        contentLength,
        ip,
        userAgent,
      }

      const endpoint = this.endpointKey(method, typeof req.route?.path === 'string' ? req.route.path : '/:unmatched')
      this.metrics.incrementRequestByEndpoint(endpoint)
      this.metrics.observeEndpointLatency(endpoint, duration)
      if (statusCode >= 400) {
        this.metrics.incrementErrorByEndpoint(endpoint)
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
