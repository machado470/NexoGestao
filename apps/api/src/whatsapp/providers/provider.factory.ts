// apps/api/src/whatsapp/providers/provider.factory.ts
/**
 * Factory de provider WhatsApp.
 *
 * Seleciona o provider com base na variável de ambiente WHATSAPP_PROVIDER:
 *   - "mock"  → MockWhatsAppProvider (sem envio real)
 *   - "zapi"  → ZApiWhatsAppProvider (envio real via Z-API)
 *
 * Para adicionar um novo provider:
 *   1. Implemente a interface WhatsAppProvider em um novo arquivo
 *   2. Adicione o case no switch abaixo
 *   3. Defina WHATSAPP_PROVIDER=<nome> no .env
 */
import { Logger } from '@nestjs/common'
import { WhatsAppProvider } from './whatsapp.provider'
import { MockWhatsAppProvider } from './mock.provider'
import { ZApiWhatsAppProvider } from './zapi.provider'

const logger = new Logger('WhatsAppProviderFactory')

type ProviderName = 'mock' | 'zapi'

export type WhatsAppProviderReadiness = {
  providerRequested: string
  providerResolved: ProviderName
  isProviderKnown: boolean
  selectedLabel: 'mock' | 'z-api'
  credentialsReady: boolean
  missingEnv: string[]
  isReady: boolean
  mode: 'mock' | 'real'
}

function normalizeProviderName(providerName: string): {
  resolved: ProviderName
  known: boolean
} {
  if (providerName === 'zapi') return { resolved: 'zapi', known: true }
  if (providerName === 'mock') return { resolved: 'mock', known: true }
  return { resolved: 'mock', known: false }
}

export function getWhatsAppProviderReadiness(
  env: NodeJS.ProcessEnv = process.env,
): WhatsAppProviderReadiness {
  const providerRequested = (env.WHATSAPP_PROVIDER ?? 'mock').toLowerCase().trim()
  const normalized = normalizeProviderName(providerRequested)

  if (normalized.resolved === 'mock') {
    return {
      providerRequested,
      providerResolved: 'mock',
      isProviderKnown: normalized.known,
      selectedLabel: 'mock',
      credentialsReady: true,
      missingEnv: [],
      isReady: true,
      mode: 'mock',
    }
  }

  const requiredEnvForZapi = ['ZAPI_INSTANCE_ID', 'ZAPI_TOKEN', 'ZAPI_CLIENT_TOKEN']
  const missingEnv = requiredEnvForZapi.filter(
    (key) => (env[key] ?? '').trim().length === 0,
  )

  return {
    providerRequested,
    providerResolved: 'zapi',
    isProviderKnown: normalized.known,
    selectedLabel: 'z-api',
    credentialsReady: missingEnv.length === 0,
    missingEnv,
    isReady: missingEnv.length === 0,
    mode: 'real',
  }
}

export function createWhatsAppProvider(): WhatsAppProvider {
  const readiness = getWhatsAppProviderReadiness()

  switch (readiness.providerResolved) {
    case 'zapi':
      if (readiness.credentialsReady) {
        logger.log('[BOOT] [WhatsApp] Provider selecionado: Z-API')
      } else {
        logger.warn(
          `[OPTIONAL][integration-missing-config] [WhatsApp] Z-API selecionado sem credenciais completas; execução seguirá em modo degradado.`,
        )
      }
      return new ZApiWhatsAppProvider()

    case 'mock':
    default:
      if (!readiness.isProviderKnown) {
        logger.warn(
          `[OPTIONAL][warn-local] [WhatsApp] Provider desconhecido: "${readiness.providerRequested}". Usando mock.`,
        )
      } else {
        logger.log('[OPTIONAL][simulated-mode] [WhatsApp] Provider selecionado: Mock (sem envio real)')
      }
      return new MockWhatsAppProvider()
  }
}
