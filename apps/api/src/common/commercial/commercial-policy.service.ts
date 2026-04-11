import { Injectable } from '@nestjs/common'
import { PlanName, SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { TenantOperationsService } from '../tenant-ops/tenant-ops.service'

export type CommercialMeterKey =
  | 'automation_executions'
  | 'message_sends'
  | 'finance_critical_actions'
  | 'configurable_automations'

export type CommercialFeatureKey =
  | 'advanced_automation'
  | 'premium_integrations'
  | 'high_limits'
  | 'priority_support'

type PlanPolicy = {
  displayName: string
  limits: Record<CommercialMeterKey, number>
  features: Record<CommercialFeatureKey, boolean>
}

export type CommercialDecision =
  | { allowed: true }
  | {
      allowed: false
      reasonCode: string
      reasonMessage: string
      policyType: 'commercial_block'
    }

export function isCommercialBlocked(
  decision: CommercialDecision | (CommercialDecision & { limit?: number; used?: number }),
): decision is Extract<CommercialDecision, { allowed: false }> & { limit?: number; used?: number } {
  return decision.allowed === false
}

@Injectable()
export class CommercialPolicyService {
  private readonly defaultPolicies: Record<PlanName, PlanPolicy> = {
    FREE: {
      displayName: 'Free',
      limits: {
        automation_executions: 200,
        message_sends: 300,
        finance_critical_actions: 100,
        configurable_automations: 3,
      },
      features: {
        advanced_automation: false,
        premium_integrations: false,
        high_limits: false,
        priority_support: false,
      },
    },
    STARTER: {
      displayName: 'Basic',
      limits: {
        automation_executions: 2_500,
        message_sends: 2_000,
        finance_critical_actions: 800,
        configurable_automations: 20,
      },
      features: {
        advanced_automation: false,
        premium_integrations: false,
        high_limits: false,
        priority_support: false,
      },
    },
    PRO: {
      displayName: 'Pro',
      limits: {
        automation_executions: 15_000,
        message_sends: 8_000,
        finance_critical_actions: 4_000,
        configurable_automations: 100,
      },
      features: {
        advanced_automation: true,
        premium_integrations: true,
        high_limits: true,
        priority_support: false,
      },
    },
    BUSINESS: {
      displayName: 'Enterprise',
      limits: {
        automation_executions: 100_000,
        message_sends: 50_000,
        finance_critical_actions: 20_000,
        configurable_automations: 1_000,
      },
      features: {
        advanced_automation: true,
        premium_integrations: true,
        high_limits: true,
        priority_support: true,
      },
    },
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantOps: TenantOperationsService,
  ) {}

  async getContext(orgId: string) {
    const subscription =
      (await this.prisma.subscription.findUnique({
        where: { orgId },
        include: { plan: true },
      })) ??
      (await this.ensureDefaultSubscription(orgId))

    const planName = subscription.plan.name
    const defaultPolicy = this.defaultPolicies[planName]

    const planLimits = this.coerceNumberRecord<CommercialMeterKey>(
      subscription.plan.limitsJson,
      defaultPolicy.limits,
    )

    const planFeatures = this.coerceBooleanRecord<CommercialFeatureKey>(
      subscription.plan.featuresJson,
      defaultPolicy.features,
    )

    const overrides = await this.prisma.tenantFeatureOverride.findMany({
      where: { orgId },
    })

    const effectiveFeatures = { ...planFeatures }
    for (const item of overrides) {
      const key = item.featureKey as CommercialFeatureKey
      if (key in effectiveFeatures) {
        effectiveFeatures[key] = item.enabled
      }
    }

    return {
      subscription,
      planName,
      planDisplayName: subscription.plan.displayName || defaultPolicy.displayName,
      limits: planLimits,
      features: effectiveFeatures,
      featureOverrides: overrides,
    }
  }

  async canUseFeature(orgId: string, feature: CommercialFeatureKey): Promise<CommercialDecision> {
    const context = await this.getContext(orgId)
    const status = context.subscription.status

    if (status === SubscriptionStatus.SUSPENDED) {
      return {
        allowed: false,
        policyType: 'commercial_block',
        reasonCode: 'tenant_subscription_suspended',
        reasonMessage: 'Assinatura suspensa por política comercial.',
      }
    }

    if (status === SubscriptionStatus.CANCELED) {
      return {
        allowed: false,
        policyType: 'commercial_block',
        reasonCode: 'tenant_subscription_cancelled',
        reasonMessage: 'Assinatura cancelada. Faça upgrade para reativar este recurso.',
      }
    }

    if (status === SubscriptionStatus.PAST_DUE) {
      return {
        allowed: false,
        policyType: 'commercial_block',
        reasonCode: 'tenant_subscription_past_due',
        reasonMessage: 'Assinatura com pagamento pendente.',
      }
    }

    if (
      status === SubscriptionStatus.TRIALING &&
      context.subscription.currentPeriodEnd < new Date()
    ) {
      return {
        allowed: false,
        policyType: 'commercial_block',
        reasonCode: 'tenant_trial_expired',
        reasonMessage: 'Trial expirado. Recurso restrito até atualizar o plano.',
      }
    }

    if (!context.features[feature]) {
      if (process.env.NODE_ENV === 'development') {
        return { allowed: true }
      }
      return {
        allowed: false,
        policyType: 'commercial_block',
        reasonCode: 'feature_not_in_plan',
        reasonMessage: `Recurso indisponível no plano ${context.planDisplayName}.`,
      }
    }

    return { allowed: true }
  }

  async enforceMeter(orgId: string, meter: CommercialMeterKey): Promise<CommercialDecision & { limit?: number; used?: number }> {
    const context = await this.getContext(orgId)
    const limit = context.limits[meter]
    const used = this.estimateUsage(orgId, meter)

    if (used >= limit) {
      return {
        allowed: false,
        policyType: 'commercial_block',
        reasonCode: 'plan_limit_reached',
        reasonMessage: `Limite do plano ${context.planDisplayName} atingido para ${meter}.`,
        limit,
        used,
      }
    }

    return { allowed: true, limit, used }
  }

  async getAdminTenantCommercialOverview() {
    const tenants = await this.prisma.organization.findMany({
      include: {
        subscription: {
          include: { plan: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    const items = await Promise.all(
      tenants.map(async (tenant) => {
        const context = await this.getContext(tenant.id)
        const usage = {
          automation_executions: this.estimateUsage(tenant.id, 'automation_executions'),
          message_sends: this.estimateUsage(tenant.id, 'message_sends'),
          finance_critical_actions: this.estimateUsage(tenant.id, 'finance_critical_actions'),
          configurable_automations: this.estimateUsage(tenant.id, 'configurable_automations'),
        }

        const nearLimit = Object.entries(context.limits).some(([key, value]) => {
          const current = usage[key as CommercialMeterKey] ?? 0
          return Number(value) > 0 && current / Number(value) >= 0.8
        })

        const commerciallyBlocked =
          context.subscription.status === SubscriptionStatus.SUSPENDED
          || context.subscription.status === SubscriptionStatus.PAST_DUE
          || context.subscription.status === SubscriptionStatus.CANCELED

        return {
          tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
          subscription: {
            status: context.subscription.status,
            currentPeriodStart: context.subscription.currentPeriodStart,
            currentPeriodEnd: context.subscription.currentPeriodEnd,
            plan: context.planDisplayName,
            planCode: context.planName,
          },
          limits: context.limits,
          usage,
          features: context.features,
          nearLimit,
          commerciallyBlocked,
        }
      }),
    )

    return {
      tenantCount: items.length,
      nearLimitTenants: items.filter((item) => item.nearLimit).length,
      blockedTenants: items.filter((item) => item.commerciallyBlocked).length,
      tenants: items,
    }
  }

  async upsertFeatureOverride(
    orgId: string,
    featureKey: string,
    enabled: boolean,
    reason?: string,
  ) {
    return this.prisma.tenantFeatureOverride.upsert({
      where: {
        orgId_featureKey: {
          orgId,
          featureKey,
        },
      },
      update: {
        enabled,
        reason: reason?.trim() || null,
      },
      create: {
        orgId,
        featureKey,
        enabled,
        reason: reason?.trim() || null,
      },
    })
  }

  private estimateUsage(orgId: string, meter: CommercialMeterKey): number {
    const snapshot = this.tenantOps.snapshot()
    const tenant = snapshot.perTenant.find((item) => item.orgId === orgId)
    if (!tenant) return 0

    switch (meter) {
      case 'automation_executions':
        return Number(tenant.counters.automation_execution ?? 0)
      case 'message_sends':
        return Number(tenant.counters.whatsapp_queued ?? 0)
      case 'finance_critical_actions':
        return Number(tenant.counters.finance_charge_create ?? 0) + Number(tenant.counters.finance_charge_pay ?? 0)
      case 'configurable_automations':
        return Number(tenant.counters.automation_execution ?? 0)
      default:
        return 0
    }
  }

  private coerceNumberRecord<T extends string>(value: unknown, fallback: Record<T, number>) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ...fallback }
    }

    const payload = value as Record<string, unknown>
    const output: Record<string, number> = { ...fallback }

    for (const key of Object.keys(fallback)) {
      if (typeof payload[key] === 'number') {
        output[key] = payload[key] as number
      }
    }

    return output as Record<T, number>
  }

  private coerceBooleanRecord<T extends string>(value: unknown, fallback: Record<T, boolean>) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ...fallback }
    }

    const payload = value as Record<string, unknown>
    const output: Record<string, boolean> = { ...fallback }

    for (const key of Object.keys(fallback)) {
      if (typeof payload[key] === 'boolean') {
        output[key] = payload[key] as boolean
      }
    }

    return output as Record<T, boolean>
  }

  private async ensureDefaultSubscription(orgId: string) {
    const freePlan = await this.prisma.plan.findUnique({ where: { name: PlanName.FREE } })
    if (!freePlan) {
      throw new Error('Plano FREE não encontrado. Inicialização de planos é obrigatória.')
    }

    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    return this.prisma.subscription.create({
      data: {
        orgId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    })
  }
}
