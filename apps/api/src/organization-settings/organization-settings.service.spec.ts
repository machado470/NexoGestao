import { OrganizationSettingsService } from './organization-settings.service'
import { PrismaService } from '../prisma/prisma.service'

const organization = {
  id: 'org-1',
  name: 'Oficina Antiga',
  slug: 'oficina-antiga',
  timezone: 'America/Sao_Paulo',
  currency: 'BRL',
}

const actor = { userId: "admin-user", personId: "admin-person" }

const mockPrisma = {
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  auditEvent: { create: jest.fn() },
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
}

describe('OrganizationSettingsService', () => {
  const service = new OrganizationSettingsService(mockPrisma as unknown as PrismaService)

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(callback => callback(mockPrisma))
    mockPrisma.$queryRaw.mockResolvedValue([organization])
  })

  it('carrega as configurações persistidas pelo id da organização autenticada', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(organization)

    await expect(service.getOrganizationSettings('org-1')).resolves.toEqual({
      ...organization,
      currentPlan: 'Nenhum',
      membersCount: 0,
    })
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org-1' } }),
    )
  })

  it('salva name e timezone usando o contrato canônico', async () => {
    mockPrisma.organization.update.mockResolvedValue({ ...organization, name: 'Oficina Nova', timezone: 'UTC' })

    await service.updateOrganizationSettings('org-1', { name: 'Oficina Nova', timezone: 'UTC' }, actor)

    expect(mockPrisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org-1' },
        data: { name: 'Oficina Nova', timezone: 'UTC' },
      }),
    )
  })

  it('registra apenas os campos alterados e identifica o administrador', async () => {
    mockPrisma.organization.update.mockResolvedValue({ ...organization, currency: 'USD' })
    await service.updateOrganizationSettings('org-1', { currency: 'USD', name: organization.name }, actor)
    expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orgId: 'org-1', entityId: 'org-1', action: 'ORGANIZATION_SETTINGS_UPDATED',
        actorUserId: actor.userId, actorPersonId: actor.personId,
        metadata: { currencyBefore: 'BRL', currencyAfter: 'USD' },
      }),
    })
  })

  it('evita registro e escrita quando os valores são idênticos', async () => {
    await service.updateOrganizationSettings('org-1', { currency: 'BRL' }, actor)
    expect(mockPrisma.organization.update).not.toHaveBeenCalled()
    expect(mockPrisma.auditEvent.create).not.toHaveBeenCalled()
  })

  it('isola tenants usando exclusivamente o orgId autenticado recebido pelo service', async () => {
    mockPrisma.organization.update.mockResolvedValue({ ...organization, id: 'org-authenticated', name: 'Tenant Correto' })

    await service.updateOrganizationSettings('org-authenticated', { name: 'Tenant Correto' }, actor)

    expect(mockPrisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org-authenticated' }, data: { name: 'Tenant Correto' } }),
    )
  })
})


describe('OrganizationSettingsService administrative summary', () => {
  it('produz decisões oficiais com evidência isolada pelo tenant', async () => {
    const prisma = { $transaction: jest.fn().mockResolvedValue([{ ...organization, createdAt: new Date(), executionConfig: null }, [{ id: 'admin-1', email: 'a@nexo.test', role: 'ADMIN', active: true, inviteExpiresAt: null, createdAt: new Date(), person: null }]]), organization: { findUnique: jest.fn() }, user: { findMany: jest.fn() } } as any
    const result = await new OrganizationSettingsService(prisma).getAdministrativeSummary('org-1')
    expect(prisma.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'org-1' } }))
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: 'org-1' } }))
    expect(result.sections.find((item) => item.key === 'permissions')?.state).toBe('CONFIGURED')
    expect(result.integrations).toMatchObject({ available: false, state: 'NOT_EVALUATED' })
  })
})
