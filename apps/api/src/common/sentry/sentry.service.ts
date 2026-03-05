import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

/**
 * SentryService — Wrapper para integração com Sentry.
 * Inicializa o Sentry se SENTRY_DSN estiver configurado.
 * Captura exceções, performance e contexto de org/request.
 */
@Injectable()
export class SentryService implements OnModuleInit {
  private readonly logger = new Logger(SentryService.name)
  private sentry: any = null
  private initialized = false

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const dsn = this.config.get<string>('SENTRY_DSN')
    if (!dsn) {
      this.logger.warn('SENTRY_DSN não configurado — monitoramento desativado')
      return
    }

    try {
      const Sentry = await import('@sentry/node')
      const { nodeProfilingIntegration } = await import('@sentry/profiling-node')

      Sentry.init({
        dsn,
        environment: this.config.get<string>('SENTRY_ENVIRONMENT', 'production'),
        tracesSampleRate: parseFloat(
          this.config.get<string>('SENTRY_TRACES_SAMPLE_RATE', '0.1'),
        ),
        profilesSampleRate: 0.1,
        integrations: [
          nodeProfilingIntegration(),
        ],
        beforeSend(event) {
          // Remover dados sensíveis antes de enviar
          if (event.request?.headers) {
            delete event.request.headers['authorization']
            delete event.request.headers['cookie']
          }
          return event
        },
      })

      this.sentry = Sentry
      this.initialized = true
      this.logger.log(`Sentry inicializado (env: ${this.config.get('SENTRY_ENVIRONMENT', 'production')})`)
    } catch (err) {
      this.logger.warn(`Falha ao inicializar Sentry: ${err.message}`)
    }
  }

  /**
   * Captura uma exceção no Sentry com contexto adicional
   */
  captureException(error: Error, context?: Record<string, any>): string | undefined {
    if (!this.initialized || !this.sentry) return undefined

    return this.sentry.withScope((scope: any) => {
      if (context) {
        scope.setExtras(context)
      }
      return this.sentry.captureException(error)
    })
  }

  /**
   * Define o contexto do usuário/org para o Sentry
   */
  setUserContext(userId: string, orgId: string, email?: string) {
    if (!this.initialized || !this.sentry) return

    this.sentry.setUser({ id: userId, email, orgId })
    this.sentry.setTag('orgId', orgId)
  }

  /**
   * Adiciona o requestId como tag no Sentry
   */
  setRequestContext(requestId: string, orgId?: string) {
    if (!this.initialized || !this.sentry) return

    this.sentry.setTag('requestId', requestId)
    if (orgId) this.sentry.setTag('orgId', orgId)
  }

  /**
   * Captura uma mensagem informativa no Sentry
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    if (!this.initialized || !this.sentry) return

    this.sentry.captureMessage(message, level)
  }

  get isInitialized(): boolean {
    return this.initialized
  }
}
