import { WhatsAppProviderFactory } from './provider.factory'

describe('WhatsAppProviderFactory hardening', () => {
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
