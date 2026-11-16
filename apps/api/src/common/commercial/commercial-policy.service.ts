import { BadRequestException, Injectable } from '@nestjs/common'
import { PlanName, Prisma, SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { TenantOperationsService } from '../tenant-ops/tenant-ops.service'
import { CommercialDecision, subscriptionAccess } from './subscription-access'
export type { CommercialDecision } from './subscription-access'

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

  async getContext(orgId: string, database: Prisma.TransactionClient = this.prisma) {
    const subscription =
      (await database.subscription.findUnique({
        where: { orgId },
        include: { plan: true },
      })) ??
      (await this.ensureDefaultSubscription(orgId, database))

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

    const overrides = await database.tenantFeatureOverride.findMany({
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
    const access = subscriptionAccess(context.subscription)
    if (isCommercialBlocked(access)) return access

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

  async enforceMeter(orgId: string, meter: CommercialMeterKey, options?: { admissionOnly?: boolean }): Promise<CommercialDecision & { limit?: number; used?: number }> {
    const context = await this.getContext(orgId)
    const access = subscriptionAccess(context.subscription)
    if (isCommercialBlocked(access)) return access
    const limit = context.limits[meter]
    if (meter === 'configurable_automations' && !(this.prisma as any).automationRule?.count) return { allowed: false, policyType: 'commercial_block', reasonCode: 'commercial_meter_unavailable', reasonMessage: 'Configuração de automações indisponível nesta versão.' }
    if (options?.admissionOnly) return { allowed: true }
    const used = await this.readUsage(this.prisma, orgId, meter)

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
          automation_executions: await this.readUsage(this.prisma, tenant.id, 'automation_executions'),
          message_sends: await this.readUsage(this.prisma, tenant.id, 'message_sends'),
          finance_critical_actions: await this.readUsage(this.prisma, tenant.id, 'finance_critical_actions'),
          configurable_automations: await this.readUsage(this.prisma, tenant.id, 'configurable_automations'),
        }

        const nearLimit = Object.entries(context.limits).some(([key, value]) => {
          const current = usage[key as CommercialMeterKey] ?? 0
          return Number(value) > 0 && current / Number(value) >= 0.8
        })

        const commerciallyBlocked = !subscriptionAccess(context.subscription).allowed

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
          usagePeriod: commercialUsagePeriod(),
          meterAvailability: { configurable_automations: Boolean((this.prisma as any).automationRule?.count) },
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

  async lockMeterInTransaction(tx: Prisma.TransactionClient, orgId: string, meter: CommercialMeterKey) {
    // One tenant/meter lock across periods also serializes operations crossing midnight.
    await tx.$queryRaw`SELECT 1::int AS "locked" FROM pg_advisory_xact_lock(hashtextextended(${`commercial:v1:${orgId}:${meter}`}, 0))`
  }

  async assertMeterInTransaction(tx: Prisma.TransactionClient, orgId: string, meter: CommercialMeterKey) {
    await this.lockMeterInTransaction(tx, orgId, meter)
    const context = await this.getContext(orgId, tx)
    const access = subscriptionAccess(context.subscription)
    if (isCommercialBlocked(access)) throw new BadRequestException({ message: access.reasonMessage, reasonCode: access.reasonCode, policyType: access.policyType })
    if (meter === 'configurable_automations' && !(tx as any).automationRule?.count) throw new BadRequestException({ message: 'Configuração de automações indisponível nesta versão.', reasonCode: 'commercial_meter_unavailable' })
    const used = await this.readUsage(tx, orgId, meter), limit = context.limits[meter]
    if (used >= limit) throw new BadRequestException({ message: `Limite do plano ${context.planDisplayName} atingido.`, reasonCode: 'plan_limit_reached', policyType: 'commercial_block', used, limit })
    return { used, limit, period: commercialUsagePeriod() }
  }

  private async readUsage(database: Prisma.TransactionClient, orgId: string, meter: CommercialMeterKey): Promise<number> {
    const period = commercialUsagePeriod(), createdAt = { gte: period.start, lt: period.end }
    switch (meter) {
      case 'message_sends': return database.whatsAppMessage.count({ where: { orgId, direction: 'OUTBOUND', createdAt } })
      case 'finance_critical_actions': {
        const [charges, payments] = await Promise.all([
          database.charge.count({ where: { orgId, createdAt } }),
          database.payment.count({ where: { orgId, createdAt, OR: [{ externalRef: null }, { NOT: { externalRef: { startsWith: 'stripe:' } } }] } }),
        ])
        return charges + payments
      }
      case 'automation_executions': {
        const started = await database.timelineEvent.count({ where: { orgId, action: 'EXECUTION_EVENT', createdAt, metadata: { path: ['eventType'], equals: 'EXECUTION_STARTED' } } })
        return started + ((database as any).automationExecution?.count ? await (database as any).automationExecution.count({ where: { orgId, createdAt } }) : 0)
      }
      case 'configurable_automations': return (database as any).automationRule?.count ? (database as any).automationRule.count({ where: { orgId } }) : 0
    }
  }

  private coerceNumberRecord<T extends string>(value: unknown, fallback: Record<T, number>) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ...fallback }
    }

    const payload = value as Record<string, unknown>
    const output: Record<string, number> = { ...fallback }

    for (const key of Object.keys(fallback)) {
      if (typeof payload[key] === 'number' && Number.isSafeInteger(payload[key]) && Number(payload[key]) >= 0) {
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

  private async ensureDefaultSubscription(orgId: string, database: Prisma.TransactionClient) {
    const freePlan = await database.plan.findUnique({ where: { name: PlanName.FREE } })
    if (!freePlan) {
      throw new Error('Plano FREE não encontrado. Inicialização de planos é obrigatória.')
    }

    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setMonth(periodEnd.getMonth() + 1)

    return database.subscription.upsert({
      where: { orgId }, update: {},
      create: {
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

/** Consumption is monthly by UTC calendar, independent of provider invoice/proration dates. */
export function commercialUsagePeriod(now = new Date()) {
  return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)), timezone: 'UTC' as const }
}
