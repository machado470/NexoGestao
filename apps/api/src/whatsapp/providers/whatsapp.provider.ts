// apps/api/src/whatsapp/providers/whatsapp.provider.ts

import { MockWhatsAppProvider } from './mock.provider'

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

function normalizePhone(value: string) {
  return String(value ?? '').replace(/\D/g, '')
}

export class ZApiWhatsAppProvider implements WhatsAppProvider {
  private readonly instanceId: string
  private readonly instanceToken: string
  private readonly clientToken?: string
  private readonly baseUrl: string

  constructor() {
    this.instanceId = String(process.env.ZAPI_INSTANCE_ID ?? '').trim()
    this.instanceToken = String(process.env.ZAPI_INSTANCE_TOKEN ?? '').trim()
    this.clientToken =
      String(process.env.ZAPI_CLIENT_TOKEN ?? '').trim() || undefined
    this.baseUrl = String(
      process.env.ZAPI_BASE_URL ?? 'https://api.z-api.io',
    )
      .trim()
      .replace(/\/$/, '')
  }

  private isConfigured() {
    return Boolean(this.instanceId && this.instanceToken)
  }

  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        provider: 'zapi',
        errorCode: 'NOT_CONFIGURED',
        errorMessage:
          'Z-API não configurada. Defina ZAPI_INSTANCE_ID e ZAPI_INSTANCE_TOKEN.',
      }
    }

    const phone = normalizePhone(input.toPhone)

    if (!phone) {
      return {
        ok: false,
        provider: 'zapi',
        errorCode: 'INVALID_PHONE',
        errorMessage: 'Telefone inválido para envio via Z-API.',
      }
    }

    const url = `${this.baseUrl}/instances/${this.instanceId}/token/${this.instanceToken}/send-text`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.clientToken) {
      headers['Client-Token'] = this.clientToken
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone,
          message: input.text,
        }),
      })

      const rawText = await response.text()
      let data: any = null

      try {
        data = rawText ? JSON.parse(rawText) : null
      } catch {
        data = { rawText }
      }

      if (!response.ok) {
        return {
          ok: false,
          provider: 'zapi',
          errorCode: `HTTP_${response.status}`,
          errorMessage:
            data?.message ||
            data?.error ||
            data?.rawText ||
            `Falha HTTP ${response.status} ao enviar mensagem pela Z-API.`,
        }
      }

      const providerMessageId = String(
        data?.messageId ??
          data?.zaapId ??
          data?.id ??
          `zapi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      )

      return {
        ok: true,
        provider: 'zapi',
        providerMessageId,
      }
    } catch (error: any) {
      return {
        ok: false,
        provider: 'zapi',
        errorCode: 'NETWORK_ERROR',
        errorMessage:
          error?.message ?? 'Erro de rede ao enviar mensagem via Z-API.',
      }
    }
  }
}

export function createWhatsAppProvider(): WhatsAppProvider {
  const provider = String(process.env.WHATSAPP_PROVIDER ?? 'mock')
    .trim()
    .toLowerCase()

  if (provider === 'zapi') {
    return new ZApiWhatsAppProvider()
  }

  return new MockWhatsAppProvider()
}
