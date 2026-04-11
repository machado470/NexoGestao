import { Injectable } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import type { ExecutionMode, ExecutionPolicyConfig } from './execution.types'

const DEFAULT_POLICY: ExecutionPolicyConfig = {
  allowAutomaticCharge: true,
  allowWhatsAppAuto: true,
  allowOverdueReminderAuto: true,
  allowFinanceTeamNotifications: true,
  allowGovernanceFollowup: true,
  allowChargeFollowupCreation: true,
  allowRiskReviewEscalation: true,
  maxRetries: 3,
  throttleWindowMs: 1000 * 60 * 30,
}

function normalizeMode(raw: string | undefined): ExecutionMode {
  if (raw === 'auto') {
    return 'automatic'
  }
  if (raw === 'manual' || raw === 'semi_automatic' || raw === 'automatic') {
    return raw
  }
  return 'automatic'
}

function readPositiveIntEnv(name: string, fallback: number, bounds?: { min?: number; max?: number }): number {
  const raw = Number(process.env[name])
  if (!Number.isFinite(raw)) return fallback
  const normalized = Math.trunc(raw)
  if (bounds?.min !== undefined && normalized < bounds.min) return fallback
  if (bounds?.max !== undefined && normalized > bounds.max) return fallback
  return normalized
}

@Injectable()
export class ExecutionConfigService {
  private readonly modeCache = new Map<string, ExecutionMode>()
  private readonly policyCache = new Map<string, Partial<ExecutionPolicyConfig>>()

  constructor(private readonly prisma: PrismaService) {}

  getDefaultMode(): ExecutionMode {
    if (process.env.NODE_ENV === 'development') {
      return 'manual'
    }
    return normalizeMode(process.env.EXECUTION_MODE_DEFAULT)
  }

  getMaxExecutionsPerCycle(): number {
    return readPositiveIntEnv('EXECUTION_MAX_PER_CYCLE', 5, { min: 1, max: 200 })
  }

  getCycleDelayMs(): number {
    return readPositiveIntEnv('EXECUTION_CYCLE_DELAY_MS', 1_500, { min: 250, max: 60_000 })
  }

  getBlockedRecentCooldownMs(): number {
    return readPositiveIntEnv('EXECUTION_BLOCKED_RECENT_COOLDOWN_MS', 60_000, {
      min: 5_000,
      max: 60 * 60_000,
    })
  }

  private sanitizePolicy(value: unknown): Partial<ExecutionPolicyConfig> {
    if (!value || typeof value !== 'object') return {}
    const input = value as Record<string, unknown>
    const output: Partial<ExecutionPolicyConfig> = {}

    if (typeof input.allowAutomaticCharge === 'boolean') {
      output.allowAutomaticCharge = input.allowAutomaticCharge
    }
    if (typeof input.allowWhatsAppAuto === 'boolean') {
      output.allowWhatsAppAuto = input.allowWhatsAppAuto
    }
    if (typeof input.allowOverdueReminderAuto === 'boolean') {
      output.allowOverdueReminderAuto = input.allowOverdueReminderAuto
    }
    if (typeof input.allowFinanceTeamNotifications === 'boolean') {
      output.allowFinanceTeamNotifications = input.allowFinanceTeamNotifications
    }
    if (typeof input.allowGovernanceFollowup === 'boolean') {
      output.allowGovernanceFollowup = input.allowGovernanceFollowup
    }
    if (typeof input.allowChargeFollowupCreation === 'boolean') {
      output.allowChargeFollowupCreation = input.allowChargeFollowupCreation
    }
    if (typeof input.allowRiskReviewEscalation === 'boolean') {
      output.allowRiskReviewEscalation = input.allowRiskReviewEscalation
    }
    if (Number.isFinite(input.maxRetries)) {
      output.maxRetries = Math.max(0, Number(input.maxRetries))
    }
    if (Number.isFinite(input.throttleWindowMs)) {
      output.throttleWindowMs = Math.max(5_000, Number(input.throttleWindowMs))
    }
    return output
  }

  async getExecutionMode(context: { orgId: string }): Promise<ExecutionMode> {
    const cached = this.modeCache.get(context.orgId)
    if (cached) return cached

    const config = await (this.prisma as any).organizationExecutionConfig.findUnique({
      where: { orgId: context.orgId },
      select: { mode: true, policy: true },
    })

    const mode = config?.mode ?? this.getDefaultMode()
    this.modeCache.set(context.orgId, mode)
    if (config?.policy) {
      this.policyCache.set(context.orgId, this.sanitizePolicy(config.policy))
    }
    return mode
  }

  async getPolicyConfig(context: { orgId: string }): Promise<ExecutionPolicyConfig> {
    const cached = this.policyCache.get(context.orgId)
    if (cached) {
      return { ...DEFAULT_POLICY, ...cached }
    }

    const config = await (this.prisma as any).organizationExecutionConfig.findUnique({
      where: { orgId: context.orgId },
      select: { policy: true },
    })

    const persisted = this.sanitizePolicy(config?.policy)
    this.policyCache.set(context.orgId, persisted)

    return {
      ...DEFAULT_POLICY,
      ...persisted,
    }
  }

  async setExecutionModeForOrg(orgId: string, mode: ExecutionMode) {
    const nextMode = normalizeMode(mode)
    const before = await this.getExecutionMode({ orgId })
    await (this.prisma as any).organizationExecutionConfig.upsert({
      where: { orgId },
      update: { mode: nextMode },
      create: { orgId, mode: nextMode },
    })
    this.modeCache.set(orgId, nextMode)
    return { before, after: nextMode }
  }

  async setPolicyOverrideForOrg(orgId: string, policy: Partial<ExecutionPolicyConfig>) {
    const sanitized = this.sanitizePolicy(policy)
    const before = await this.getPolicyConfig({ orgId })
    const after = { ...before, ...sanitized }
    await (this.prisma as any).organizationExecutionConfig.upsert({
      where: { orgId },
      update: { policy: sanitized },
      create: {
        orgId,
        mode: this.getDefaultMode(),
        policy: sanitized,
      },
    })
    this.policyCache.set(orgId, sanitized)
    return { before, after, persistedOverride: sanitized }
  }

  async recordConfigHistory(input: {
    orgId: string
    actorUserId?: string | null
    actorEmail?: string | null
    source?: string | null
    context?: string | null
    before: Record<string, unknown>
    after: Record<string, unknown>
  }) {
    await this.prisma.timelineEvent.create({
      data: {
        orgId: input.orgId,
        action: 'EXECUTION_CONFIG_CHANGED',
        description: 'Configuração de execution atualizada',
        metadata: {
          orgId: input.orgId,
          actorUserId: input.actorUserId ?? null,
          actorEmail: input.actorEmail ?? null,
          source: input.source ?? 'execution_api',
          context: input.context ?? null,
          changedAt: new Date().toISOString(),
          before: input.before,
          after: input.after,
        } as Prisma.InputJsonObject,
      },
    })
  }

  async listConfigHistory(orgId: string, limit = 20) {
    const rows = await this.prisma.timelineEvent.findMany({
      where: {
        orgId,
        action: 'EXECUTION_CONFIG_CHANGED',
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(100, Number(limit) || 20)),
      select: {
        id: true,
        createdAt: true,
        metadata: true,
      },
    })

    return rows.map((row) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>
      return {
        id: row.id,
        orgId,
        actorUserId: typeof metadata.actorUserId === 'string' ? metadata.actorUserId : null,
        actorEmail: typeof metadata.actorEmail === 'string' ? metadata.actorEmail : null,
        source: typeof metadata.source === 'string' ? metadata.source : null,
        context: typeof metadata.context === 'string' ? metadata.context : null,
        changedAt:
          typeof metadata.changedAt === 'string' && metadata.changedAt
            ? metadata.changedAt
            : row.createdAt.toISOString(),
        before: typeof metadata.before === 'object' && metadata.before ? metadata.before : {},
        after: typeof metadata.after === 'object' && metadata.after ? metadata.after : {},
      }
    })
  }
}
