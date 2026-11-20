import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'

/** Codes are part of the API contract: uppercase identifiers only, never free text. */
export const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/

/** Stable codes for statuses that clients must handle even when the thrower set none. */
const DEFAULT_CODE_BY_STATUS: Partial<Record<number, string>> = {
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
}

export const INTERNAL_ERROR_MESSAGE = 'Internal server error'

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse()
    const req = ctx.getRequest()

    const isHttp = exception instanceof HttpException
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const payload = isHttp ? exception.getResponse() : null

    // Unexpected errors (Prisma, driver, programming errors) may carry table names, queries or
    // configuration: their text stays in the server log, never in the response.
    if (!isHttp) {
      const name = exception instanceof Error ? exception.name : typeof exception
      this.logger.error(
        `unhandled_exception name=${name} requestId=${req?.requestId ?? '-'}`,
        exception instanceof Error ? exception.stack : undefined,
      )
    }
    const message = isHttp ? this.extractMessage(payload, exception) : INTERNAL_ERROR_MESSAGE

    // Headers already set by guards (e.g. Retry-After from the throttler) are kept as is.
    res.status(status).json({
      success: false,
      error: message,
      message,
      code: this.extractCode(payload) ?? DEFAULT_CODE_BY_STATUS[status] ?? null,
      data: null,
      path: req?.originalUrl ?? req?.url ?? null,
      requestId: req?.requestId ?? null,
    })
  }

  private extractCode(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null
    const code = (payload as Record<string, unknown>).code
    return typeof code === 'string' && SAFE_ERROR_CODE.test(code) ? code : null
  }

  private extractMessage(payload: unknown, exception: unknown): string {
    if (typeof payload === 'string') return payload
    if (payload && typeof payload === 'object') {
      const p = payload as Record<string, unknown>
      if (Array.isArray(p.message)) return p.message.join(' | ')
      if (typeof p.message === 'string') return p.message
      if (typeof p.error === 'string') return p.error
    }
    if (exception instanceof Error) return exception.message
    return INTERNAL_ERROR_MESSAGE
  }
}
