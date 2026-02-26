// apps/api/src/whatsapp/providers/whatsapp.provider.ts

export type WhatsAppSendInput = {
  toPhone: string
  text: string
}

export type WhatsAppSendResult =
  | { ok: true; provider: string; providerMessageId: string }
  | { ok: false; provider: string; errorCode: string; errorMessage: string }

export interface WhatsAppProvider {
  send(input: WhatsAppSendInput): Promise<WhatsAppSendResult>
}
