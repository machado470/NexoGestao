import { ParsedWebhookMessage, WhatsAppProvider, WhatsAppProviderHealth, WhatsAppSendResult, WhatsAppSendTemplateInput, WhatsAppSendTextInput } from './whatsapp.provider'

export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  private readonly providerName = 'meta_cloud'
  async sendMessage(_input: WhatsAppSendTextInput): Promise<WhatsAppSendResult> {
    return { ok: false, provider: this.providerName, errorCode: 'NOT_IMPLEMENTED', errorMessage: 'Meta Cloud API stub' }
  }
  async sendText(input: WhatsAppSendTextInput): Promise<WhatsAppSendResult> { return this.sendMessage(input) }
  async sendTemplate(input: WhatsAppSendTemplateInput): Promise<WhatsAppSendResult> { return this.sendText({ toPhone: input.toPhone, text: input.renderedText }) }
  parseWebhook(): ParsedWebhookMessage[] { return [] }
  verifyWebhookSignature(): boolean { return true }
  mapProviderStatus(): ParsedWebhookMessage['eventType'] { return 'MESSAGE_RECEIVED' }
  getProviderName(): string { return this.providerName }
  checkHealth(): WhatsAppProviderHealth { return { provider: this.providerName, status: 'misconfigured', missingEnv: ['META_ACCESS_TOKEN','META_PHONE_NUMBER_ID'] } }
}
