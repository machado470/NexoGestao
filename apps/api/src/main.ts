import './tracing'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ApiExceptionFilter } from './common/http/api-exception.filter'
import helmet from 'helmet'

import { AppModule } from './app.module'
import { ApiResponseInterceptor } from './common/http/api-response.interceptor'

function parseCorsOrigins(raw?: string): string[] {
  const v = (raw ?? '').trim()
  if (!v) return ['http://localhost:3010', 'http://127.0.0.1:3010']

  return v
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const bootStartedAt = Date.now()
  const cwd = process.cwd()
  const runningFromWindowsMount = /^\/mnt\/[a-z]\//i.test(cwd)

  try {
    logger.log(`[BOOT] Processo iniciado em cwd=${cwd}`)
    if (runningFromWindowsMount) {
      logger.warn(
        '[BOOT][WSL] Repositório em filesystem montado do Windows (/mnt/*). ' +
          'No watch mode do TypeScript/Nest isso pode causar compilação inicial muito lenta. ' +
          'Para previsibilidade, prefira ~/NexoGestao dentro do FS nativo do WSL.',
      )
    }
    logger.log('[BOOT] Bootstrap iniciado: criando aplicação Nest...')
    const app = await NestFactory.create(AppModule, { rawBody: true })
    logger.log(`[BOOT] NestFactory.create concluído em ${Date.now() - bootStartedAt}ms`)

    app.use(
      helmet({
        contentSecurityPolicy: process.env.NODE_ENV === 'production',
        crossOriginEmbedderPolicy: false,
      }),
    )

    app.useGlobalInterceptors(new ApiResponseInterceptor())
    app.useGlobalFilters(new ApiExceptionFilter())
    app.setGlobalPrefix('v1')

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
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Org-Id',
        'X-Request-Id',
        'X-Correlation-Id',
        'Idempotency-Key',
      ],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-Request-Id', 'X-Correlation-Id'],
    })

    
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NexoGestao API')
      .setDescription('Production-ready API documentation for NexoGestao services')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addServer('/v1')
      .build()
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig)
    SwaggerModule.setup('api', app, swaggerDocument)

    const portRaw = process.env.API_PORT || process.env.PORT || '3000'
    const port = Number(portRaw) || 3000

    logger.log(`[BOOT] Iniciando listener HTTP em 0.0.0.0:${port}...`)
    await app.listen(port, '0.0.0.0')
    const totalMs = Date.now() - bootStartedAt

    logger.log(`[READY] API online na porta ${port}`)
    logger.log(`[READY] Bootstrap total: ${totalMs}ms`)
    logger.log(`[BOOT] API_PORT=${process.env.API_PORT || 'não definido'} | PORT=${process.env.PORT || 'não definido'}`)
    logger.log(`[BOOT] CORS_ORIGINS: ${origins.join(', ')}`)
    logger.log(`[BOOT] NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : 'Sem stack disponível'

    logger.error('[FATAL] Erro fatal no bootstrap')
    logger.error(message)
    const errno = err as NodeJS.ErrnoException | undefined
    if (errno?.code === 'EADDRINUSE') {
      const requestedPort = process.env.API_PORT || process.env.PORT || '3000'
      const suggestedPort = Number(requestedPort) + 1
      logger.error(
        `Conflito de porta detectado (EADDRINUSE) na API: ${requestedPort}. ` +
          `Tente API_PORT=${suggestedPort} ou libere a porta atual.`,
      )
    }
    logger.error(stack)
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
