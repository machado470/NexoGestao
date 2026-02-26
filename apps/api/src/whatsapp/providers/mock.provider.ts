// apps/api/src/whatsapp/providers/mock.provider.ts

import { WhatsAppProvider, WhatsAppSendInput, WhatsAppSendResult } from './whatsapp.provider'

export class MockWhatsAppProvider implements WhatsAppProvider {
  private readonly providerName = 'mock'

  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    const to = (input.toPhone ?? '').trim()

    // Simples validação pra simular falhas reais
    if (!to || to.length < 10) {
      return {
        ok: false,
        provider: this.providerName,
        errorCode: 'INVALID_PHONE',
        errorMessage: 'Telefone inválido ou ausente',
      }
    }

    // “Enviou”
    const providerMessageId = `mock_${Date.now()}_${Math.random().toString(16).slice(2)}`
    return { ok: true, provider: this.providerName, providerMessageId }
  }
}
