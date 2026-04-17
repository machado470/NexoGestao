// apps/api/src/whatsapp/providers/zapi.provider.ts
/**
 * Provider Z-API para envio de mensagens WhatsApp.
 *
 * Configuração via variáveis de ambiente:
 *   ZAPI_INSTANCE_ID   — ID da instância Z-API
 *   ZAPI_TOKEN         — Token de autenticação da instância
 *   ZAPI_CLIENT_TOKEN  — Client token da conta (header Client-Token)
 *
 * Documentação: https://developer.z-api.io/
 */
import { Logger } from '@nestjs/common'
import {
  WhatsAppProvider,
  WhatsAppSendInput,
  WhatsAppSendResult,
} from './whatsapp.provider'

const ZAPI_BASE_URL = 'https://api.z-api.io'
const ZAPI_TIMEOUT_MS = 12_000

export class ZApiWhatsAppProvider implements WhatsAppProvider {
  private readonly providerName = 'z-api'
  private readonly logger = new Logger(ZApiWhatsAppProvider.name)
  private readonly instanceId: string
  private readonly token: string
  private readonly clientToken: string

  constructor() {
    this.instanceId = process.env.ZAPI_INSTANCE_ID ?? ''
    this.token = process.env.ZAPI_TOKEN ?? ''
    this.clientToken = process.env.ZAPI_CLIENT_TOKEN ?? ''

    const missing = this.getMissingConfig()
    if (missing.length > 0) {
      this.logger.log(
        `[OPTIONAL][integration-missing-config] [Z-API] Configuração incompleta (${missing.join(', ')}). Mensagens não serão enviadas até corrigir o .env.`,
      )
    }
  }

  private getMissingConfig(): string[] {
    const missing: string[] = []
    if (!this.instanceId) missing.push('ZAPI_INSTANCE_ID')
    if (!this.token) missing.push('ZAPI_TOKEN')
    if (!this.clientToken) missing.push('ZAPI_CLIENT_TOKEN')
    return missing
  }

  /**
   * Normaliza o número de telefone para o formato aceito pela Z-API.
   * Remove caracteres não numéricos e garante o código do país (55 para Brasil).
   */
  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('55') && digits.length >= 12) return digits
    if (digits.length === 10 || digits.length === 11) return `55${digits}`
    return digits
  }

  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    const missing = this.getMissingConfig()

    if (missing.length > 0) {
      return {
        ok: false,
        provider: this.providerName,
        errorCode: 'NOT_CONFIGURED',
        errorMessage: `Z-API não configurada. Defina no .env: ${missing.join(', ')}`,
      }
    }

    const phone = this.normalizePhone(input.toPhone)

    if (phone.length < 12) {
      return {
        ok: false,
        provider: this.providerName,
        errorCode: 'INVALID_PHONE',
        errorMessage: `Telefone inválido: ${input.toPhone}`,
      }
    }

    const url = `${ZAPI_BASE_URL}/instances/${this.instanceId}/token/${this.token}/send-text`

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(ZAPI_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({
          phone,
          message: input.text,
        }),
      })

      const body = await response.json().catch(() => ({})) as Record<string, any>

      if (!response.ok) {
        const errorMessage =
          body?.message ?? body?.error ?? `HTTP ${response.status}`

        const statusErrorCode =
          response.status === 401
            ? 'UNAUTHORIZED'
            : response.status === 403
              ? 'FORBIDDEN'
              : `HTTP_${response.status}`

        this.logger.warn(
          `[Z-API] Falha ao enviar para ${phone}: ${errorMessage}`,
        )

        return {
          ok: false,
          provider: this.providerName,
          errorCode: statusErrorCode,
          errorMessage,
        }
      }

      const providerMessageId =
        body?.messageId ?? body?.zaapId ?? body?.id ?? `zapi_${Date.now()}`

      this.logger.log(
        `[Z-API] Mensagem enviada para ${phone} — id=${providerMessageId}`,
      )

      return {
        ok: true,
        provider: this.providerName,
        providerMessageId: String(providerMessageId),
      }
    } catch (err: any) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        const errorMessage = `Timeout ao enviar WhatsApp após ${ZAPI_TIMEOUT_MS}ms`
        this.logger.error(`[Z-API] ${errorMessage}`)
        return {
          ok: false,
          provider: this.providerName,
          errorCode: 'TIMEOUT',
          errorMessage,
        }
      }
      const errorMessage = err?.message ?? 'Erro de rede desconhecido'
      this.logger.error(`[Z-API] Exceção ao enviar para ${phone}: ${errorMessage}`)
      return {
        ok: false,
        provider: this.providerName,
        errorCode: 'NETWORK_ERROR',
        errorMessage,
      }
    }
  }
}
