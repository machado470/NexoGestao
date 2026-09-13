import { provisionWhatsAppProviderAccount } from './whatsapp-provider-account.provisioning'

function fixture(account?: { orgId: string }) {
  const upsert = jest.fn().mockImplementation(({ create }) => Promise.resolve({
    id: 'mapping-1', provider: create.provider, accountId: create.accountId,
    orgId: account?.orgId ?? create.orgId, active: true,
  }))
  return {
    prisma: {
      organization: { findUnique: jest.fn().mockResolvedValue({ id: 'org-1' }) },
      whatsAppProviderAccount: { upsert },
    },
    upsert,
  }
}

describe('provisionWhatsAppProviderAccount', () => {
  it('cria associação legítima para organização explicitamente selecionada', async () => {
    const { prisma, upsert } = fixture()
    await expect(provisionWhatsAppProviderAccount(prisma, {
      orgSlug: 'cliente-a', provider: 'meta_cloud', accountId: 'phone-123',
    })).resolves.toMatchObject({ orgId: 'org-1', provider: 'meta_cloud', accountId: 'phone-123' })
    expect(prisma.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'cliente-a' } }))
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {}, create: expect.objectContaining({ orgId: 'org-1' }) }))
  })

  it('é idempotente e não atualiza ownership na reexecução', async () => {
    const { prisma, upsert } = fixture({ orgId: 'org-1' })
    await provisionWhatsAppProviderAccount(prisma, { orgId: 'org-1', provider: 'zapi', accountId: 'instance-1' })
    await provisionWhatsAppProviderAccount(prisma, { orgId: 'org-1', provider: 'zapi', accountId: 'instance-1' })
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert.mock.calls.every(([args]) => Object.keys(args.update).length === 0)).toBe(true)
  })

  it('falha explicitamente se a conta pertence a outro tenant', async () => {
    const { prisma } = fixture({ orgId: 'org-2' })
    await expect(provisionWhatsAppProviderAccount(prisma, {
      orgId: 'org-1', provider: 'meta_cloud', accountId: 'phone-123',
    })).rejects.toThrow('conflito de ownership')
  })

  it.each([
    { orgId: 'org-1', provider: '', accountId: 'account-1' },
    { orgId: 'org-1', provider: 'desconhecido', accountId: 'account-1' },
    { orgId: 'org-1', provider: 'meta_cloud', accountId: '' },
  ])('rejeita conta ausente ou inválida: %j', async (input) => {
    const { prisma, upsert } = fixture()
    await expect(provisionWhatsAppProviderAccount(prisma, input)).rejects.toThrow()
    expect(upsert).not.toHaveBeenCalled()
  })

  it('não cria associação implícita sem uma única organização explícita e existente', async () => {
    const { prisma, upsert } = fixture()
    await expect(provisionWhatsAppProviderAccount(prisma, {
      provider: 'meta_cloud', accountId: 'phone-123',
    } as any)).rejects.toThrow('exatamente um')
    await expect(provisionWhatsAppProviderAccount(prisma, {
      orgId: 'org-1', orgSlug: 'cliente-a', provider: 'meta_cloud', accountId: 'phone-123',
    } as any)).rejects.toThrow('exatamente um')
    prisma.organization.findUnique.mockResolvedValueOnce(null)
    await expect(provisionWhatsAppProviderAccount(prisma, {
      orgId: 'missing', provider: 'meta_cloud', accountId: 'phone-123',
    })).rejects.toThrow('organização não encontrada')
    expect(upsert).not.toHaveBeenCalled()
  })
})
