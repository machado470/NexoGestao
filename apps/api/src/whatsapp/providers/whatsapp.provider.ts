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

/**
 * Erros fatais não devem voltar para fila em loop infinito.
 * Ex.: credenciais ausentes/inválidas, assinatura da instância expirada/inativa.
 */
export function isFatalWhatsAppSendError(result: WhatsAppSendErrorResult): boolean {
  const normalizedCode = (result.errorCode ?? '').toUpperCase()
  const normalizedMessage = (result.errorMessage ?? '').toLowerCase()

  if (
    normalizedCode === 'NOT_CONFIGURED'
    || normalizedCode === 'UNAUTHORIZED'
    || normalizedCode === 'FORBIDDEN'
    || normalizedCode === 'HTTP_401'
    || normalizedCode === 'HTTP_403'
  ) {
    return true
  }

  const fatalMessageHints = [
    'subscribe to this instance again',
    'assinatura',
    'subscription',
    'instance not subscribed',
    'client-token',
    'invalid token',
    'token inválido',
    'token invalido',
  ]

  return fatalMessageHints.some((hint) => normalizedMessage.includes(hint))
}
