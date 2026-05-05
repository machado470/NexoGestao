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

  it('exige confirmação explícita para provider mock fora de produção', () => {
    expect(() =>
      WhatsAppProviderFactory.create({
        NODE_ENV: 'development',
        WHATSAPP_PROVIDER: 'mock',
      } as NodeJS.ProcessEnv),
    ).toThrow('WHATSAPP_ALLOW_MOCK=true')
  })

  it('permite provider mock somente com confirmação explícita fora de produção', () => {
    const provider = WhatsAppProviderFactory.create({
      NODE_ENV: 'test',
      WHATSAPP_PROVIDER: 'mock',
      WHATSAPP_ALLOW_MOCK: 'true',
    } as NodeJS.ProcessEnv)

    expect(provider.checkHealth().provider).toBe('mock')
  })
})
