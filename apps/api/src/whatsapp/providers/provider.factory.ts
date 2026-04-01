// apps/api/src/whatsapp/providers/provider.factory.ts
/**
 * Factory de provider WhatsApp.
 *
 * Seleciona o provider com base na variável de ambiente WHATSAPP_PROVIDER:
 *   - "mock"  → MockWhatsAppProvider (padrão, sem envio real)
 *   - "zapi"  → ZApiWhatsAppProvider (Z-API)
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

export function createWhatsAppProvider(): WhatsAppProvider {
  const providerName = (process.env.WHATSAPP_PROVIDER ?? 'mock').toLowerCase()

  switch (providerName) {
    case 'zapi':
      logger.log('[WhatsApp] Provider selecionado: Z-API')
      return new ZApiWhatsAppProvider()

    case 'mock':
    default:
      if (providerName !== 'mock') {
        logger.warn(
          `[WhatsApp] Provider desconhecido: "${providerName}". Usando mock.`,
        )
      } else {
        logger.log('[WhatsApp] Provider selecionado: Mock (sem envio real)')
      }
      return new MockWhatsAppProvider()
  }
}
