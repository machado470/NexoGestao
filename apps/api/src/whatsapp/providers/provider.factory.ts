import { Logger } from '@nestjs/common'
import { MockWhatsAppProvider } from './mock.provider'
import { MetaCloudWhatsAppProvider } from './meta-cloud.provider'
import { ZApiWhatsAppProvider } from './zapi.provider'
import { WhatsAppProvider, WhatsAppProviderHealth } from './whatsapp.provider'

const logger = new Logger('WhatsAppProviderFactory')

export class WhatsAppProviderFactory {
  static create(env: NodeJS.ProcessEnv = process.env): WhatsAppProvider {
    const configured = (env.WHATSAPP_PROVIDER ?? 'mock').toLowerCase().trim()
    if (configured === 'zapi') {
      logger.log('[WhatsApp] provider=zapi')
      return new ZApiWhatsAppProvider()
    }
    if (configured === 'meta_cloud') {
      logger.log('[WhatsApp] provider=meta_cloud')
      return new MetaCloudWhatsAppProvider()
    }

    if (configured !== 'mock') {
      logger.warn(`[WhatsApp] provider desconhecido (${configured}), fallback=mock`)
    }
    return new MockWhatsAppProvider()
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
  return {
    providerRequested: health.configuredProvider,
    providerResolved: health.provider,
    isProviderKnown: ['mock', 'zapi', 'meta_cloud'].includes(health.configuredProvider),
    mode: health.provider === 'mock' ? 'mock' : 'real',
    credentialsReady: health.status !== 'misconfigured',
    missingEnv: health.missingEnv,
    isReady: health.status !== 'misconfigured',
  }
}
