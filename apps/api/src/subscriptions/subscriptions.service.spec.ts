import { MethodNotAllowedException } from '@nestjs/common'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { SubscriptionsService } from './subscriptions.service'

describe('Legacy subscriptions cannot bypass billing authority', () => {
  let service: SubscriptionsService
  const db = { subscription: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() } }
  const plans = { findPlanByName: jest.fn() }
  beforeEach(() => {
    jest.resetAllMocks()
    service = new SubscriptionsService(db as any, plans as any)
  })
  it.each(Object.values(PlanName))('does not activate %s without checkout confirmation', async plan => {
    db.subscription.findUnique.mockResolvedValue({ id: 'subscription', status: SubscriptionStatus.CANCELED })
    plans.findPlanByName.mockResolvedValue({ id: 'paid-plan' })
    await expect(service.updateSubscription('org', plan)).rejects.toBeInstanceOf(MethodNotAllowedException)
    expect(db.subscription.update).not.toHaveBeenCalled()
    expect(plans.findPlanByName).not.toHaveBeenCalled()
  })
  it('does not create a fresh trial through a status read', async () => {
    db.subscription.findUnique.mockResolvedValue(null)
    plans.findPlanByName.mockResolvedValue({ id: 'starter' })
    await expect(service.checkSubscriptionStatus('org')).resolves.toBeNull()
    expect(db.subscription.create).not.toHaveBeenCalled()
  })
  it('does not overwrite provider lifecycle while reading an expired trial', async () => {
    const subscription = { id: 'subscription', status: SubscriptionStatus.TRIALING, currentPeriodEnd: new Date(0), billingProvider: 'STRIPE' }
    db.subscription.findUnique.mockResolvedValue(subscription)
    await expect(service.checkSubscriptionStatus('org')).resolves.toBe(subscription)
    expect(db.subscription.update).not.toHaveBeenCalled()
  })
  it('keeps authenticated organization scoping for reads', async () => {
    db.subscription.findUnique.mockResolvedValue({ id: 'subscription' })
    await service.checkSubscriptionStatus('org')
    expect(db.subscription.findUnique).toHaveBeenCalledWith({ where: { orgId: 'org' }, include: { plan: true } })
  })
})
