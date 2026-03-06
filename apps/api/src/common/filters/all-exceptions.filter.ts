import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { MetricsService } from '../metrics/metrics.service'

let Sentry: any = null
try { Sentry = require('@sentry/node') } catch { /* sem sentry */ }

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter')

  constructor(private readonly metrics?: MetricsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Erro interno do servidor'
    let code = 'INTERNAL_ERROR'
    let error = 'Internal Server Error'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse()
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as any
        message = Array.isArray(resp.message)
          ? resp.message.join(', ')
          : resp.message || resp.error || message
        code = resp.code || code
        error = resp.error || error
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT
          message = 'Registro duplicado'
          code = 'DUPLICATE_ENTRY'
          error = 'Conflict'
          break
        case 'P2025':
          status = HttpStatus.NOT_FOUND
          message = 'Registro não encontrado'
          code = 'NOT_FOUND'
          error = 'Not Found'
          break
        case 'P2003':
          status = HttpStatus.BAD_REQUEST
          message = 'Referência inválida'
          code = 'FOREIGN_KEY_VIOLATION'
          error = 'Bad Request'
          break
        default:
          status = HttpStatus.BAD_REQUEST
          message = 'Erro de banco de dados'
          code = `PRISMA_${exception.code}`
          error = 'Bad Request'
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST
      message = 'Dados inválidos'
      code = 'VALIDATION_ERROR'
      error = 'Bad Request'
    }

    const requestId = (request as any).requestId ?? request.headers['x-request-id'] ?? 'unknown'
    const user = (request as any).user
    const orgId = user?.orgId ?? (request.headers['x-org-id'] as string) ?? undefined
    const userId = user?.userId ?? user?.sub ?? undefined

    const endpoint = `${request.method} ${request.route?.path ?? request.path ?? request.url}`
    this.metrics?.incrementErrorByEndpoint(endpoint)

    const logMeta = {
      requestId,
      method: request.method,
      url: request.url,
      statusCode: status,
      ip: request.ip,
      orgId,
      userId,
      code,
      error,
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status}: ${message} [${requestId}]`,
        exception instanceof Error ? exception.stack : String(exception),
        JSON.stringify(logMeta),
      )
      if (Sentry && exception instanceof Error) {
        Sentry.withScope((scope: any) => {
          scope.setTag('requestId', requestId)
          if (orgId) scope.setTag('orgId', orgId)
          if (userId) scope.setUser({ id: userId })
          scope.setExtra('method', request.method)
          scope.setExtra('url', request.url)
          scope.setExtra('statusCode', status)
          Sentry.captureException(exception)
        })
      }
    } else {
      this.logger.warn(
        `${request.method} ${request.url} - ${status}: ${message} [${requestId}]`,
        JSON.stringify(logMeta),
      )
    }

    response.status(status).json({
      error,
      code,
      message,
      requestId,
    })
  }
}
