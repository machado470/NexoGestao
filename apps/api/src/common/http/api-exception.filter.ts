import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse()
    const req = ctx.getRequest()

    const isHttp = exception instanceof HttpException
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const payload = isHttp ? exception.getResponse() : null

    const message = this.extractMessage(payload, exception)

    res.status(status).json({
      success: false,
      error: message,
      message,
      data: null,
      path: req?.originalUrl ?? req?.url ?? null,
      requestId: req?.requestId ?? null,
    })
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
    return 'Internal server error'
  }
}
