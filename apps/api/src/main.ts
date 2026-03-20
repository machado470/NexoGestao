import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import helmet from 'helmet'

import { AppModule } from './app.module'
import { ApiResponseInterceptor } from './common/http/api-response.interceptor'

function parseCorsOrigins(raw?: string): string[] {
  const v = (raw ?? '').trim()
  if (!v) return ['http://localhost:3001', 'http://127.0.0.1:3001']

  return v
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  try {
    const app = await NestFactory.create(AppModule, { rawBody: true })

    app.use(
      helmet({
        contentSecurityPolicy: process.env.NODE_ENV === 'production',
        crossOriginEmbedderPolicy: false,
      }),
    )

    app.useGlobalInterceptors(new ApiResponseInterceptor())

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

    const portRaw = process.env.API_PORT || process.env.PORT || '3001'
    const port = Number(portRaw) || 3001

    await app.listen(port, '0.0.0.0')

    logger.log(`API online na porta ${port}`)
    logger.log(`CORS_ORIGINS: ${origins.join(', ')}`)
    logger.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
  } catch (err) {
    logger.error('Erro fatal no bootstrap')
    logger.error(err instanceof Error ? err.message : String(err))
    logger.error(err instanceof Error ? err.stack : 'Sem stack disponível')
    throw err
  }
}

process.on('unhandledRejection', reason => {
  const logger = new Logger('UnhandledRejection')
  logger.error(
    'Unhandled Promise Rejection',
    reason instanceof Error ? reason.stack : String(reason),
  )
  process.exit(1)
})

process.on('uncaughtException', err => {
  const logger = new Logger('UncaughtException')
  logger.error('Uncaught Exception', err.stack)
  process.exit(1)
})

void bootstrap()
