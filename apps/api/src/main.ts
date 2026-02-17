import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ApiResponseInterceptor } from './common/http/api-response.interceptor'
import { ApiExceptionFilter } from './common/http/api-exception.filter'

function parseCorsOrigins(raw?: string): string[] {
  const v = (raw ?? '').trim()
  if (!v) return ['http://localhost:5173', 'http://127.0.0.1:5173']

  return v
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule)

    app.useGlobalInterceptors(new ApiResponseInterceptor())
    app.useGlobalFilters(new ApiExceptionFilter())

    const origins = parseCorsOrigins(process.env.CORS_ORIGINS)

    app.enableCors({
      origin: origins,
      credentials: true,
    })

    const portRaw = process.env.API_PORT || process.env.PORT || '3000'
    const port = Number(portRaw) || 3000

    await app.listen(port, '0.0.0.0')

    console.log('🚀 API ONLINE NA PORTA', port)
    console.log('🌐 CORS_ORIGINS', origins.join(', '))
  } catch (err) {
    console.error('🔥 ERRO NO BOOTSTRAP', err)
    process.exit(1)
  }
}

process.on('unhandledRejection', reason => {
  console.error('🔥 UNHANDLED REJECTION', reason)
  process.exit(1)
})

process.on('uncaughtException', err => {
  console.error('🔥 UNCAUGHT EXCEPTION', err)
  process.exit(1)
})

bootstrap()
