import { getWhatsAppProviderReadiness, WhatsAppProviderFactory } from './provider.factory'
import { isFatalWhatsAppSendError, isWhatsAppSendError } from './whatsapp.provider'

describe('WhatsAppProviderFactory hardening', () => {
  it('permite desativação explícita em produção sem credenciais nem disponibilidade falsa', () => {
    const env = { NODE_ENV: 'production', WHATSAPP_PROVIDER: 'disabled' }
    expect(WhatsAppProviderFactory.create(env).checkHealth()).toEqual({
      provider: 'disabled', status: 'disabled', missingEnv: [],
    })
    expect(getWhatsAppProviderReadiness(env)).toMatchObject({
      status: 'disabled', mode: 'disabled', isProviderKnown: true,
      credentialsReady: false, isReady: false,
    })
  })

  it('recusa todos os envios sem chamar rede, gerar recibos ou aceitar webhooks', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch')
    try {
      const provider = WhatsAppProviderFactory.create({ NODE_ENV: 'production', WHATSAPP_PROVIDER: 'disabled' })
      const input = { toPhone: '+5511999999999', text: 'mensagem' }
      for (const result of await Promise.all([
        provider.sendMessage(input), provider.sendText(input),
        provider.sendTemplate({ toPhone: input.toPhone, templateKey: 'test', renderedText: input.text }),
      ])) {
        expect(result).toMatchObject({ ok: false, provider: 'disabled', errorCode: 'WHATSAPP_DISABLED', fatal: true })
        expect(result).not.toHaveProperty('providerMessageId')
        expect(isWhatsAppSendError(result) && isFatalWhatsAppSendError(result)).toBe(true)
      }
      expect(await provider.verifyWebhookSignature({})).toBe(false)
      expect(provider.parseWebhook({ text: 'oi' })).toEqual([])
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('mantém o bloqueio de mock quando produção não informa um provider', () => {
    expect(() => WhatsAppProviderFactory.create({ NODE_ENV: 'production' })).toThrow('mock não é permitido')
  })

  it('bloqueia provider mock em produção', () => {
    expect(() =>
      WhatsAppProviderFactory.create({
        NODE_ENV: 'production',
        WHATSAPP_PROVIDER: 'mock',
        WHATSAPP_ALLOW_MOCK: 'true',
      } as NodeJS.ProcessEnv),
    ).toThrow('WHATSAPP_PROVIDER=mock não é permitido em produção')
  })

  it('bloqueia provider desconhecido em produção', () => {
    expect(() =>
      WhatsAppProviderFactory.create({
        NODE_ENV: 'production',
        WHATSAPP_PROVIDER: 'sandbox',
      } as NodeJS.ProcessEnv),
    ).toThrow('WHATSAPP_PROVIDER desconhecido')
  })

  it('usa fallback mock em desenvolvimento mesmo sem confirmação explícita', () => {
    const provider = WhatsAppProviderFactory.create({
      NODE_ENV: 'development',
      WHATSAPP_PROVIDER: 'mock',
    } as NodeJS.ProcessEnv)

    expect(provider.checkHealth().provider).toBe('mock')
  })

  it('permite provider mock com confirmação explícita fora de produção', () => {
    const provider = WhatsAppProviderFactory.create({
      NODE_ENV: 'test',
      WHATSAPP_PROVIDER: 'mock',
      WHATSAPP_ALLOW_MOCK: 'true',
    } as NodeJS.ProcessEnv)

    expect(provider.checkHealth().provider).toBe('mock')
  })
})
