import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { ExecutionMode, ExecutionPolicyConfig } from './execution.types'

const DEFAULT_POLICY: ExecutionPolicyConfig = {
  allowAutomaticCharge: true,
  allowWhatsAppAuto: false,
  allowOverdueReminderAuto: true,
  allowFinanceTeamNotifications: true,
  allowGovernanceFollowup: true,
  maxRetries: 3,
  throttleWindowMs: 1000 * 60 * 30,
}

function normalizeMode(raw: string | undefined): ExecutionMode {
  if (raw === 'manual' || raw === 'semi_automatic' || raw === 'automatic') {
    return raw
  }
  return 'manual'
}

@Injectable()
export class ExecutionConfigService {
  private readonly modeCache = new Map<string, ExecutionMode>()
  private readonly policyCache = new Map<string, Partial<ExecutionPolicyConfig>>()

  constructor(private readonly prisma: PrismaService) {}

  getDefaultMode(): ExecutionMode {
    return normalizeMode(process.env.EXECUTION_MODE_DEFAULT)
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
    await (this.prisma as any).organizationExecutionConfig.upsert({
      where: { orgId },
      update: { mode: nextMode },
      create: { orgId, mode: nextMode },
    })
    this.modeCache.set(orgId, nextMode)
  }

  async setPolicyOverrideForOrg(orgId: string, policy: Partial<ExecutionPolicyConfig>) {
    const sanitized = this.sanitizePolicy(policy)
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
  }
}
