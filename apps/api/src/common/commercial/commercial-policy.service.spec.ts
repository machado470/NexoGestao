import { PlanName, SubscriptionStatus } from '@prisma/client'
import { CommercialPolicyService } from './commercial-policy.service'
import { TenantOperationsService } from '../tenant-ops/tenant-ops.service'

describe('CommercialPolicyService', () => {
  const baseNow = new Date('2026-04-10T00:00:00.000Z')

  function makeService(params?: {
    status?: SubscriptionStatus
    featuresJson?: Record<string, boolean>
    overrides?: Array<{ featureKey: string; enabled: boolean }>
  }) {
    const tenantOps = new TenantOperationsService()
    tenantOps.increment('org-1', 'automation_execution', 210)

    const prisma = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sub-1',
          orgId: 'org-1',
          status: params?.status ?? SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(baseNow.getTime() - 86_400_000),
          currentPeriodEnd: new Date(baseNow.getTime() + 86_400_000),
          plan: {
            id: 'plan-1',
            name: PlanName.FREE,
            displayName: 'Free',
            limitsJson: {
              automation_executions: 200,
              message_sends: 300,
              finance_critical_actions: 100,
              configurable_automations: 3,
            },
            featuresJson: params?.featuresJson ?? {
              advanced_automation: false,
              premium_integrations: false,
              high_limits: false,
              priority_support: false,
            },
          },
        }),
        create: jest.fn(),
      },
      plan: {
        findUnique: jest.fn(),
      },
      tenantFeatureOverride: {
        findMany: jest.fn().mockResolvedValue(params?.overrides ?? []),
        upsert: jest.fn(),
      },
      organization: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }

    const service = new CommercialPolicyService(prisma as any, tenantOps)
    return { service, prisma, tenantOps }
  }

  it('aplica bloqueio comercial por limite de plano sem confundir com throttling técnico', async () => {
    const { service } = makeService()
    const decision = await service.enforceMeter('org-1', 'automation_executions')

    expect(decision.allowed).toBe(false)
    if (!decision.allowed && 'reasonCode' in decision) {
      expect(decision.reasonCode).toBe('plan_limit_reached')
      expect(decision.policyType).toBe('commercial_block')
    }
  })

  it('respeita override por tenant em feature flag no backend', async () => {
    const { service } = makeService({
      overrides: [{ featureKey: 'advanced_automation', enabled: true }],
    })

    const decision = await service.canUseFeature('org-1', 'advanced_automation')
    expect(decision.allowed).toBe(true)
  })

  it('bloqueia tenant suspenso para capacidade premium', async () => {
    const { service } = makeService({ status: SubscriptionStatus.SUSPENDED })
    const decision = await service.canUseFeature('org-1', 'advanced_automation')

    expect(decision.allowed).toBe(false)
    if (!decision.allowed && 'reasonCode' in decision) {
      expect(decision.reasonCode).toBe('tenant_subscription_suspended')
    }
  })
})
