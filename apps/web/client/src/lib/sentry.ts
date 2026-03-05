/**
 * NexoGestao — Sentry Frontend
 * Inicializa o Sentry para monitoramento de erros e performance no browser.
 * Ativado apenas se VITE_SENTRY_DSN estiver configurado.
 */

let sentryInitialized = false

export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    console.info('[Sentry] VITE_SENTRY_DSN não configurado — monitoramento desativado')
    return
  }

  try {
    const Sentry = await import('@sentry/react')

    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'production',
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      beforeSend(event) {
        // Não enviar erros de desenvolvimento local
        if (import.meta.env.DEV) return null
        return event
      },
    })

    sentryInitialized = true
    console.info('[Sentry] Inicializado com sucesso')
  } catch (err) {
    console.warn('[Sentry] Falha ao inicializar:', err)
  }
}

/**
 * Define o contexto do usuário no Sentry
 */
export function setSentryUser(userId: string, orgId: string, email?: string) {
  if (!sentryInitialized) return

  import('@sentry/react').then(Sentry => {
    Sentry.setUser({ id: userId, email, orgId } as any)
    Sentry.setTag('orgId', orgId)
  })
}

/**
 * Limpa o contexto do usuário (logout)
 */
export function clearSentryUser() {
  if (!sentryInitialized) return

  import('@sentry/react').then(Sentry => {
    Sentry.setUser(null)
  })
}

/**
 * Captura uma exceção manualmente no Sentry
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!sentryInitialized) return

  import('@sentry/react').then(Sentry => {
    Sentry.withScope(scope => {
      if (context) scope.setExtras(context)
      Sentry.captureException(error)
    })
  })
}
