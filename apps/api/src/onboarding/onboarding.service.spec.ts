import { OnboardingService } from './onboarding.service'

describe('persisted onboarding completion evidence', () => {
  function setup(counts = [1, 1, 1], requiresOnboarding = true) {
    const prisma = {
      organization: { findUnique: jest.fn().mockResolvedValue({ requiresOnboarding }), update: jest.fn() },
      customer: { count: jest.fn().mockResolvedValue(counts[0]) },
      serviceOrder: { count: jest.fn().mockResolvedValue(counts[1]) },
      charge: { count: jest.fn().mockResolvedValue(counts[2]) },
    }
    return { prisma, service: new OnboardingService(prisma as any) }
  }
  it('reads status without changing a ready organization', async () => {
    const { prisma, service } = setup()
    expect(await service.getOnboardingStatus('org')).toEqual({ requiresOnboarding: true, steps: { createCustomer: true, createService: true, createCharge: true } })
    expect(prisma.organization.update).not.toHaveBeenCalled()
    expect(prisma.serviceOrder.count).toHaveBeenCalledWith({ where: { orgId: 'org', status: 'DONE' } })
    expect(prisma.charge.count).toHaveBeenCalledWith({ where: { orgId: 'org', status: { in: ['PENDING', 'OVERDUE', 'PAID'] }, customer: { is: { orgId: 'org' } }, serviceOrder: { is: { orgId: 'org', status: 'DONE' } } } })
  })
  it.each([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 1]])('rejects incomplete persisted evidence %j', async (...counts) => {
    const { prisma, service } = setup(counts)
    await expect(service.completeOnboarding('org')).rejects.toThrow('antes de finalizar')
    expect(prisma.organization.update).not.toHaveBeenCalled()
  })
  it('does not allow complete-step to bypass the same evidence', async () => {
    const { prisma, service } = setup([0, 0, 0])
    await expect(service.completeOnboardingStep('org', 'createCharge')).rejects.toThrow('antes de finalizar')
    expect(prisma.organization.update).not.toHaveBeenCalled()
  })
  it('does not complete when notified of an intermediate creation', async () => {
    const { prisma, service } = setup()
    await service.completeOnboardingStep('org', 'createService')
    expect(prisma.organization.update).not.toHaveBeenCalled()
  })
  it('releases only the authenticated organization after all evidence is present', async () => {
    const { prisma, service } = setup()
    expect((await service.completeOnboarding('org'))?.requiresOnboarding).toBe(false)
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: 'org' }, data: { requiresOnboarding: false } })
  })
  it('is idempotent for an organization already released and never reopens it', async () => {
    const { prisma, service } = setup([0, 0, 0], false)
    expect((await service.completeOnboarding('org'))?.requiresOnboarding).toBe(false)
    expect(prisma.organization.update).not.toHaveBeenCalled()
  })
})
