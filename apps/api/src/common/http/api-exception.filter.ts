import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'

type HttpPayload =
  | string
  | {
      message?: string | string[]
      error?: string
      statusCode?: number
    }
  | null
  | undefined

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse()
    const req = ctx.getRequest()

    const isHttp = exception instanceof HttpException
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR

    const payload: HttpPayload = isHttp
      ? (exception.getResponse() as any)
      : null

    const message = this.extractMessage(payload, exception)

    const code =
      status === 401
        ? 'UNAUTHORIZED'
        : status === 403
        ? 'FORBIDDEN'
        : status === 404
        ? 'NOT_FOUND'
        : status === 400
        ? 'BAD_REQUEST'
        : status >= 500
        ? 'INTERNAL_ERROR'
        : 'ERROR'

    res.status(status).json({
      ok: false,
      error: {
        code,
        message,
        path: req?.originalUrl ?? req?.url ?? null,
      },
    })
  }

  private extractMessage(payload: HttpPayload, exception: unknown): string {
    if (typeof payload === 'string') return payload

    if (payload && typeof payload === 'object') {
      const msg = payload.message
      if (Array.isArray(msg)) return msg.join(' | ')
      if (typeof msg === 'string') return msg
      if (typeof payload.error === 'string') return payload.error
    }

    if (
      exception &&
      typeof exception === 'object' &&
      'message' in exception &&
      typeof (exception as any).message === 'string'
    ) {
      return (exception as any).message
    }

    return 'Erro interno'
  }
}
