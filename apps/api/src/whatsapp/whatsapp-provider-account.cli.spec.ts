import { parseProvisionWhatsAppProviderAccountArgs } from './whatsapp-provider-account.cli'

describe('parseProvisionWhatsAppProviderAccountArgs', () => {
  it('aceita provider, account-id e somente org-id', () => {
    expect(parseProvisionWhatsAppProviderAccountArgs([
      '--provider', 'meta_cloud', '--account-id', 'phone-123', '--org-id', 'org-1',
    ])).toEqual({ provider: 'meta_cloud', accountId: 'phone-123', orgId: 'org-1' })
  })

  it('aceita provider, account-id e somente org-slug', () => {
    expect(parseProvisionWhatsAppProviderAccountArgs([
      '--provider', 'zapi', '--account-id', 'instance-1', '--org-slug', 'cliente-a',
    ])).toEqual({ provider: 'zapi', accountId: 'instance-1', orgSlug: 'cliente-a' })
  })

  it('rejeita a ausência de seletor de organização', () => {
    expect(() => parseProvisionWhatsAppProviderAccountArgs([
      '--provider', 'meta_cloud', '--account-id', 'phone-123',
    ])).toThrow('exatamente um')
  })

  it('rejeita org-id e org-slug juntos', () => {
    expect(() => parseProvisionWhatsAppProviderAccountArgs([
      '--provider', 'meta_cloud', '--account-id', 'phone-123',
      '--org-id', 'org-1', '--org-slug', 'cliente-a',
    ])).toThrow('exatamente um')
  })

  it('rejeita provider ausente', () => {
    expect(() => parseProvisionWhatsAppProviderAccountArgs([
      '--account-id', 'phone-123', '--org-id', 'org-1',
    ])).toThrow('provider é obrigatório')
  })

  it('rejeita account-id ausente', () => {
    expect(() => parseProvisionWhatsAppProviderAccountArgs([
      '--provider', 'meta_cloud', '--org-id', 'org-1',
    ])).toThrow('account-id é obrigatório')
  })
})
