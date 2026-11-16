import {
  ParsedWebhookMessage,
  WhatsAppProvider,
  WhatsAppProviderHealth,
  WhatsAppSendErrorResult,
  WhatsAppSendTextInput,
  WhatsAppSendTemplateInput,
} from './whatsapp.provider'

export class DisabledWhatsAppProvider implements WhatsAppProvider {
  async sendMessage(_input: WhatsAppSendTextInput): Promise<WhatsAppSendErrorResult> {
    return {
      ok: false,
      provider: 'disabled',
      errorCode: 'WHATSAPP_DISABLED',
      errorMessage: 'WhatsApp desativado neste ambiente',
      fatal: true,
    }
  }

  sendText(input: WhatsAppSendTextInput) { return this.sendMessage(input) }
  sendTemplate(input: WhatsAppSendTemplateInput) {
    return this.sendMessage({ toPhone: input.toPhone, text: input.renderedText })
  }
  parseWebhook(): ParsedWebhookMessage[] { return [] }
  verifyWebhookSignature(): boolean { return false }
  mapProviderStatus(): ParsedWebhookMessage['eventType'] { return 'MESSAGE_FAILED' }
  getProviderName(): string { return 'disabled' }
  checkHealth(): WhatsAppProviderHealth {
    return { provider: 'disabled', status: 'disabled', missingEnv: [] }
  }
}
