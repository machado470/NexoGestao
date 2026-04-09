import { Injectable } from '@nestjs/common'
import type { ExecutionMode, ExecutionPolicyConfig } from './execution.types'

const DEFAULT_POLICY: ExecutionPolicyConfig = {
  allowAutomaticCharge: true,
  allowWhatsAppAuto: false,
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
  private readonly modeOverrides = new Map<string, ExecutionMode>()
  private readonly policyOverrides = new Map<string, Partial<ExecutionPolicyConfig>>()

  getExecutionMode(context: { orgId: string }): ExecutionMode {
    const override = this.modeOverrides.get(context.orgId)
    if (override) return override

    return normalizeMode(process.env.EXECUTION_MODE_DEFAULT)
  }

  getPolicyConfig(context: { orgId: string }): ExecutionPolicyConfig {
    return {
      ...DEFAULT_POLICY,
      ...(this.policyOverrides.get(context.orgId) ?? {}),
    }
  }

  setExecutionModeForOrg(orgId: string, mode: ExecutionMode) {
    this.modeOverrides.set(orgId, mode)
  }

  setPolicyOverrideForOrg(orgId: string, policy: Partial<ExecutionPolicyConfig>) {
    this.policyOverrides.set(orgId, policy)
  }
}
