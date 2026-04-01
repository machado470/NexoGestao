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

    if (!this.instanceId || !this.token) {
      this.logger.warn(
        '[Z-API] ZAPI_INSTANCE_ID ou ZAPI_TOKEN não configurados. ' +
          'Mensagens não serão enviadas.',
      )
    }
  }

  /**
   * Normaliza o número de telefone para o formato aceito pela Z-API.
   * Remove caracteres não numéricos e garante o código do país (55 para Brasil).
   */
  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    // Se já começa com 55 e tem 12+ dígitos, está ok
    if (digits.startsWith('55') && digits.length >= 12) return digits
    // Se tem 10 ou 11 dígitos (DDD + número), adiciona 55
    if (digits.length === 10 || digits.length === 11) return `55${digits}`
    return digits
  }

  async send(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    if (!this.instanceId || !this.token) {
      return {
        ok: false,
        provider: this.providerName,
        errorCode: 'NOT_CONFIGURED',
        errorMessage:
          'Z-API não configurada. Defina ZAPI_INSTANCE_ID e ZAPI_TOKEN.',
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
        headers: {
          'Content-Type': 'application/json',
          ...(this.clientToken ? { 'Client-Token': this.clientToken } : {}),
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
        this.logger.warn(
          `[Z-API] Falha ao enviar para ${phone}: ${errorMessage}`,
        )
        return {
          ok: false,
          provider: this.providerName,
          errorCode: `HTTP_${response.status}`,
          errorMessage,
        }
      }

      // Z-API retorna { zaapId, messageId, id } em caso de sucesso
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
