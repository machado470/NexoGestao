import { Injectable } from '@nestjs/common'

type LimitBucket = {
  startedAt: number
  count: number
}

type TenantMetricEvent =
  | 'automation_execution'
  | 'automation_blocked'
  | 'automation_throttled'
  | 'whatsapp_queued'
  | 'whatsapp_blocked'
  | 'finance_charge_create'
  | 'finance_charge_pay'
  | 'integration_timeout'
  | 'integration_failure'
  | 'retry_scheduled'

export interface TenantLimitResult {
  allowed: boolean
  reason: string | null
  limit: number
  used: number
  windowMs: number
}

@Injectable()
export class TenantOperationsService {
  private readonly limitBuckets = new Map<string, LimitBucket>()
  private readonly tenantCounters = new Map<string, Map<TenantMetricEvent, number>>()
  private readonly tenantCriticalEvents = new Map<string, Array<{ type: string; at: string; details?: Record<string, unknown> }>>()

  enforceLimit(params: {
    orgId: string
    scope: string
    limit: number
    windowMs: number
    blockedReason: string
  }): TenantLimitResult {
    const now = Date.now()
    const key = `${params.orgId}:${params.scope}`
    const existing = this.limitBuckets.get(key)

    if (!existing || now - existing.startedAt >= params.windowMs) {
      this.limitBuckets.set(key, { startedAt: now, count: 1 })
      return {
        allowed: true,
        reason: null,
        limit: params.limit,
        used: 1,
        windowMs: params.windowMs,
      }
    }

    if (existing.count >= params.limit) {
      return {
        allowed: false,
        reason: params.blockedReason,
        limit: params.limit,
        used: existing.count,
        windowMs: params.windowMs,
      }
    }

    existing.count += 1
    this.limitBuckets.set(key, existing)

    return {
      allowed: true,
      reason: null,
      limit: params.limit,
      used: existing.count,
      windowMs: params.windowMs,
    }
  }

  increment(orgId: string, event: TenantMetricEvent, by = 1) {
    const orgCounters = this.tenantCounters.get(orgId) ?? new Map<TenantMetricEvent, number>()
    orgCounters.set(event, (orgCounters.get(event) ?? 0) + by)
    this.tenantCounters.set(orgId, orgCounters)
  }

  recordCriticalEvent(orgId: string, type: string, details?: Record<string, unknown>) {
    const events = this.tenantCriticalEvents.get(orgId) ?? []
    events.push({
      type,
      at: new Date().toISOString(),
      details,
    })

    this.tenantCriticalEvents.set(orgId, events.slice(-30))
  }

  snapshot() {
    const perTenant = Array.from(this.tenantCounters.entries()).map(([orgId, counters]) => {
      const total = Array.from(counters.values()).reduce((sum, value) => sum + value, 0)
      return {
        orgId,
        total,
        counters: Object.fromEntries(counters.entries()),
        criticalEvents: this.tenantCriticalEvents.get(orgId) ?? [],
      }
    })

    return {
      tenantCount: perTenant.length,
      noisyTenants: perTenant
        .slice()
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
      perTenant,
    }
  }
}
