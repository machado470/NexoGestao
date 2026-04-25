import {
  ParsedWebhookMessage,
  WhatsAppProvider,
  WhatsAppProviderHealth,
  WhatsAppSendResult,
  WhatsAppSendTemplateInput,
  WhatsAppSendTextInput,
} from './whatsapp.provider'

export class MockWhatsAppProvider implements WhatsAppProvider {
  private readonly providerName = 'mock'

  async send(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult> {
    return this.sendText(input)
  }

  sendText(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult> {
    const to = (input.toPhone ?? '').trim()
    if (!to || to.length < 10) {
      return Promise.resolve({
        ok: false,
        provider: this.providerName,
        errorCode: 'INVALID_PHONE',
        errorMessage: 'Telefone inválido ou ausente',
      })
    }

    return Promise.resolve({
      ok: true,
      provider: this.providerName,
      providerMessageId: `mock_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    })
  }

  sendTemplate(input: WhatsAppSendTemplateInput): Promise<WhatsAppSendResult> {
    return this.sendText({ toPhone: input.toPhone, text: input.renderedText })
  }

  parseWebhook(payload: unknown): ParsedWebhookMessage[] {
    const data = (payload ?? {}) as Record<string, any>
    const phone = String(data.phone ?? data.from ?? '').trim() || null
    const text = String(data.text ?? data.message ?? '').trim() || null

    if (!phone && !text) return []

    return [{
      eventType: String(data.eventType ?? 'message.received'),
      fromPhone: phone,
      toPhone: String(data.to ?? '').trim() || null,
      content: text,
      providerMessageId: String(data.messageId ?? '').trim() || null,
      timestamp: new Date(),
      metadata: data,
    }]
  }

  getProviderName(): string {
    return this.providerName
  }

  checkHealth(): WhatsAppProviderHealth {
    return {
      provider: this.providerName,
      status: 'configured_mock',
      missingEnv: [],
    }
  }
}
