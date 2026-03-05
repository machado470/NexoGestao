import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ApiResponseInterceptor } from './common/http/api-response.interceptor'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { ValidationPipe, Logger } from '@nestjs/common'
import { StructuredLoggerService } from './common/logger/structured-logger.service'
import helmet from 'helmet'
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware'

function parseCorsOrigins(raw?: string): string[] {
  const v = (raw ?? '').trim()
  if (!v) return ['http://localhost:5173', 'http://127.0.0.1:5173']

  return v
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

async function bootstrap() {
  const structuredLogger = new StructuredLoggerService()

  try {
    const app = await NestFactory.create(AppModule, {
      logger: structuredLogger,
    })

    // ✅ Helmet — headers de segurança HTTP
    app.use(
      helmet({
        contentSecurityPolicy: process.env.NODE_ENV === 'production',
        crossOriginEmbedderPolicy: false,
      }),
    )

    // ✅ Middleware de log de requisições
    const requestLogger = new RequestLoggerMiddleware()
    app.use((req: any, res: any, next: any) => requestLogger.use(req, res, next))

    // ✅ Interceptor de resposta padronizada
    app.useGlobalInterceptors(new ApiResponseInterceptor())

    // ✅ Filtro global de exceções (captura Prisma, HTTP, genérico)
    app.useGlobalFilters(new AllExceptionsFilter())

    // ✅ Validação real (DTOs com class-validator)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    )

    const origins = parseCorsOrigins(process.env.CORS_ORIGINS)

    app.enableCors({
      origin: origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Org-Id'],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    })

    const portRaw = process.env.API_PORT || process.env.PORT || '3000'
    const port = Number(portRaw) || 3000

    await app.listen(port, '0.0.0.0')

    structuredLogger.log(`API online na porta ${port}`, 'Bootstrap')
    structuredLogger.log(`CORS_ORIGINS: ${origins.join(', ')}`, 'Bootstrap')
    structuredLogger.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`, 'Bootstrap')
  } catch (err) {
    structuredLogger.error('Erro fatal no bootstrap', err instanceof Error ? err.stack : String(err), 'Bootstrap')
    process.exit(1)
  }
}

process.on('unhandledRejection', reason => {
  const logger = new Logger('UnhandledRejection')
  logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason.stack : String(reason))
  process.exit(1)
})

process.on('uncaughtException', err => {
  const logger = new Logger('UncaughtException')
  logger.error('Uncaught Exception', err.stack)
  process.exit(1)
})

bootstrap()
