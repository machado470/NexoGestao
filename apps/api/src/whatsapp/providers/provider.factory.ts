import { Logger } from '@nestjs/common'
import { MockWhatsAppProvider } from './mock.provider'
import { DisabledWhatsAppProvider } from './disabled.provider'
import { MetaCloudWhatsAppProvider } from './meta-cloud.provider'
import { ZApiWhatsAppProvider } from './zapi.provider'
import { WhatsAppProvider, WhatsAppProviderHealth } from './whatsapp.provider'

const logger = new Logger('WhatsAppProviderFactory')
const KNOWN_PROVIDERS = ['disabled', 'mock', 'zapi', 'meta_cloud'] as const

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return (env.NODE_ENV ?? '').toLowerCase().trim() === 'production'
}

function isTruthy(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'y', 'on'].includes((value ?? '').toLowerCase().trim())
}

export class WhatsAppProviderFactory {
  static create(env: NodeJS.ProcessEnv = process.env): WhatsAppProvider {
    const configured = (env.WHATSAPP_PROVIDER ?? 'mock').toLowerCase().trim()

    if (!KNOWN_PROVIDERS.includes(configured as any)) {
      if (isProduction(env)) {
        throw new Error(
          `[WhatsApp] WHATSAPP_PROVIDER desconhecido (${configured}). Valores válidos: ${KNOWN_PROVIDERS.join(', ')}`,
        )
      }

      logger.warn(
        `[BOOT][WhatsApp][dev-fallback] WHATSAPP_PROVIDER desconhecido (${configured}); usando provider mock em desenvolvimento`,
      )
      return new MockWhatsAppProvider()
    }

    if (configured === 'disabled') {
      logger.log('[BOOT][WhatsApp] provider=disabled; envios e webhooks indisponíveis')
      return new DisabledWhatsAppProvider()
    }

    if (configured === 'mock') {
      if (isProduction(env)) {
        throw new Error('[WhatsApp] WHATSAPP_PROVIDER=mock não é permitido em produção')
      }
      if (!isTruthy(env.WHATSAPP_ALLOW_MOCK)) {
        logger.warn(
          '[BOOT][WhatsApp][dev-fallback] WHATSAPP_ALLOW_MOCK não definido; provider mock liberado somente porque NODE_ENV!=production',
        )
      } else {
        logger.warn('[BOOT][WhatsApp] provider=mock explicitamente habilitado')
      }
      return new MockWhatsAppProvider()
    }

    if (configured === 'zapi') {
      logger.log('[BOOT][WhatsApp] provider=zapi')
      return new ZApiWhatsAppProvider()
    }

    logger.log('[BOOT][WhatsApp] provider=meta_cloud')
    return new MetaCloudWhatsAppProvider()
  }

  static health(env: NodeJS.ProcessEnv = process.env): WhatsAppProviderHealth & { configuredProvider: string } {
    const configuredProvider = (env.WHATSAPP_PROVIDER ?? 'mock').toLowerCase().trim()
    const provider = this.create(env)
    return {
      configuredProvider,
      ...provider.checkHealth(),
    }
  }
}

export function createWhatsAppProvider(): WhatsAppProvider {
  return WhatsAppProviderFactory.create(process.env)
}

export function getWhatsAppProviderReadiness(env: NodeJS.ProcessEnv = process.env) {
  const health = WhatsAppProviderFactory.health(env)
  const ready = health.status === 'configured' || health.status === 'configured_mock'
  return {
    providerRequested: health.configuredProvider,
    providerResolved: health.provider,
    isProviderKnown: KNOWN_PROVIDERS.includes(health.configuredProvider as any),
    status: health.status,
    mode: health.provider === 'disabled' ? 'disabled' : health.provider === 'mock' ? 'mock' : 'real',
    credentialsReady: ready,
    missingEnv: health.missingEnv,
    isReady: ready,
  }
}
