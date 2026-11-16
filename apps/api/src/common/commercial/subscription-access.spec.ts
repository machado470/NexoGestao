import { PlanName, SubscriptionStatus } from '@prisma/client'
import { subscriptionAccess } from './subscription-access'
import { CommercialPolicyService } from './commercial-policy.service'
import { TenantOperationsService } from '../tenant-ops/tenant-ops.service'
import { QuotasService } from '../../quotas/quotas.service'
import { ManualPaymentsService } from '../../finance/manual-payments.service'
import { WhatsAppService } from '../../whatsapp/whatsapp.service'

const blockedCases = [
  [SubscriptionStatus.SUSPENDED, 'tenant_subscription_suspended'],
  [SubscriptionStatus.PAST_DUE, 'tenant_subscription_past_due'],
  [SubscriptionStatus.CANCELED, 'tenant_subscription_cancelled'],
  [SubscriptionStatus.TRIALING, 'tenant_trial_expired'],
] as const
const admissionMethods = ['canCreateCustomer', 'canCreateAppointment', 'canCreateServiceOrder', 'canSendMessage', 'canAddStaffMember'] as const

function fixture(status: SubscriptionStatus, future = false) {
  const subscription = { orgId: 'org', status, currentPeriodEnd: new Date(Date.now() + (future ? 86400000 : -86400000)), plan: { name: PlanName.PRO, displayName: 'Pro', limitsJson: {}, featuresJson: {} } }
  const db = { timelineEvent: { count: jest.fn().mockResolvedValue(0) }, charge: { count: jest.fn().mockResolvedValue(0) }, payment: { count: jest.fn().mockResolvedValue(0) }, subscription: { findUnique: jest.fn().mockResolvedValue(subscription) }, tenantFeatureOverride: { findMany: jest.fn().mockResolvedValue([{ featureKey: 'advanced_automation', enabled: true }]) },
    customer: { count: jest.fn().mockResolvedValue(0) }, appointment: { count: jest.fn().mockResolvedValue(0) }, serviceOrder: { count: jest.fn().mockResolvedValue(0) }, whatsAppMessage: { count: jest.fn().mockResolvedValue(0) }, user: { count: jest.fn().mockResolvedValue(0) },
    organization: { findMany: jest.fn().mockResolvedValue([{ id: 'org', name: 'QA' }]) } }
  const ops = new TenantOperationsService(), commercial = new CommercialPolicyService(db as any, ops), quotas = new QuotasService(db as any)
  return { db, subscription, commercial, quotas, ops }
}

describe('Shared subscription admission policy', () => {
  it.each(blockedCases)('%s blocks features, all meters and quota admissions, even below FREE limits', async (status, reasonCode) => {
    const f = fixture(status)
    const decision = { allowed: false, reasonCode, policyType: 'commercial_block', reasonMessage: expect.any(String) }
    expect(await f.commercial.canUseFeature('org', 'advanced_automation')).toEqual(decision)
    for (const meter of ['message_sends', 'finance_critical_actions', 'automation_executions', 'configurable_automations'] as const) expect(await f.commercial.enforceMeter('org', meter)).toEqual(decision)
    expect(await f.quotas.getOrgPlan('org')).toBe('FREE')
    for (const method of admissionMethods) expect(await f.quotas[method]('org')).toBe(false)
    await expect(f.quotas.validateQuota('org', 'CREATE_CUSTOMER')).rejects.toMatchObject({ response: { reasonCode, policyType: 'commercial_block' } })
    expect(f.db.customer.count).not.toHaveBeenCalled()
    const overview = await f.commercial.getAdminTenantCommercialOverview()
    expect(overview.blockedTenants).toBe(1)
  })
  it.each([SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING])('%s preserves plan, quotas, features and meters', async status => {
    const f = fixture(status, true)
    expect(await f.quotas.getOrgPlan('org')).toBe('PRO')
    for (const method of admissionMethods) expect(await f.quotas[method]('org')).toBe(true)
    expect((await f.commercial.enforceMeter('org', 'message_sends')).allowed).toBe(true)
    expect((await f.commercial.canUseFeature('org', 'advanced_automation')).allowed).toBe(true)
  })
  it('expires a trial exactly at its end and rejects invalid dates/states', () => {
    const now = new Date('2026-11-11T12:00:00Z')
    expect(subscriptionAccess({ status: 'TRIALING', currentPeriodEnd: now }, now).allowed).toBe(false)
    expect(subscriptionAccess({ status: 'TRIALING', currentPeriodEnd: new Date(NaN) }, now).allowed).toBe(false)
    expect(subscriptionAccess({ status: 'UNKNOWN' as any, currentPeriodEnd: now }, now).allowed).toBe(false)
  })
  it('keeps the existing FREE fallback for organizations without a subscription', async () => {
    const f = fixture('ACTIVE'); f.db.subscription.findUnique.mockResolvedValue(null as any)
    expect(await f.quotas.getOrgPlan('org')).toBe('FREE')
    expect(await f.quotas.canCreateCustomer('org')).toBe(true)
  })
  it('does not admit mutations on subscription lookup failure', async () => {
    const f = fixture('ACTIVE'); f.db.subscription.findUnique.mockRejectedValue(new Error('database unavailable'))
    await expect(f.quotas.canCreateCustomer('org')).rejects.toThrow('database unavailable')
    await expect(f.quotas.validateQuota('org', 'CREATE_CUSTOMER')).rejects.toThrow('database unavailable')
    expect(f.db.customer.count).not.toHaveBeenCalled()
  })
  it('does not bypass suspension through a feature override or development mode', async () => {
    const previous = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'development'
      const f = fixture('SUSPENDED')
      expect((await f.commercial.canUseFeature('org', 'advanced_automation')).allowed).toBe(false)
    } finally { process.env.NODE_ENV = previous }
  })
  it('preserves quota reads for a suspended organization', async () => {
    const f = fixture('SUSPENDED'), usage = await f.quotas.getQuotaUsage('org')
    expect(usage.plan).toBe('FREE'); expect(usage.usage.customers.used).toBe(0)
  })
  it.each(blockedCases)('%s stops manual payment and WhatsApp before persistence/queue admission', async (status, reasonCode) => {
    const f = fixture(status), finance = { payCharge: jest.fn() }, queue = { reserveWhatsAppAdmission: jest.fn(), addJob: jest.fn() }
    const payment = new ManualPaymentsService(finance as any, f.ops, f.commercial)
    await expect(payment.pay('org', 'actor', 'charge', { amountCents: 100, method: 'CASH' })).rejects.toThrow(reasonCode)
    expect(finance.payCharge).not.toHaveBeenCalled()
    const whatsapp = new WhatsAppService(f.db as any, queue as any, {} as any, {} as any, {} as any, f.ops, f.commercial, {} as any)
    await expect(whatsapp.enqueueMessage('org', { toPhone: '11999999999', content: 'Synthetic test' })).rejects.toThrow(reasonCode)
    expect(queue.reserveWhatsAppAdmission).not.toHaveBeenCalled(); expect(queue.addJob).not.toHaveBeenCalled()
  })
})
