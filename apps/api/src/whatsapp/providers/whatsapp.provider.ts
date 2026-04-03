// apps/api/src/whatsapp/providers/whatsapp.provider.ts

export type WhatsAppSendInput = {
  toPhone: string
  text: string
}

export type WhatsAppSendSuccessResult = {
  ok: true
  provider: string
  providerMessageId: string
}

export type WhatsAppSendErrorResult = {
  ok: false
  provider: string
  errorCode: string
  errorMessage: string
}

export type WhatsAppSendResult =
  | WhatsAppSendSuccessResult
  | WhatsAppSendErrorResult

export interface WhatsAppProvider {
  send(input: WhatsAppSendInput): Promise<WhatsAppSendResult>
}

export function isWhatsAppSendError(
  result: WhatsAppSendResult,
): result is WhatsAppSendErrorResult {
  return result.ok === false
}
