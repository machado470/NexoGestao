import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    console.error('🔥 EXCEPTION:', exception)

    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const res = exception.getResponse()

      return response.status(status).json({
        success: false,
        error: {
          status,
          message:
            typeof res === 'string'
              ? res
              : (res as any).message ?? 'Erro',
        },
      })
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        status: 500,
        message: 'Erro interno',
      },
    })
  }
}
