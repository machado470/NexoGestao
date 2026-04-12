export type ExecutionMode = 'manual' | 'semi_automatic' | 'automatic'

export type ExecutionPolicyConfig = {
  allowAutomaticCharge: boolean
  allowWhatsAppAuto: boolean
  allowOverdueReminderAuto: boolean
  allowFinanceTeamNotifications: boolean
  allowGovernanceFollowup: boolean
  allowChargeFollowupCreation: boolean
  allowRiskReviewEscalation: boolean
  maxRetries: number
  throttleWindowMs: number
}

export type ExecutionStateSummary = {
  pending: number
  executed: number
  failed: number
  blocked: number
  blockedRecent: number
  skipped: number
  throttled: number
}

export type ExecutionGovernanceStatus =
  | 'allowed'
  | 'blocked'
  | 'requires_confirmation'

export type ExecutionRunnerStatus =
  | 'pending'
  | 'executed'
  | 'failed'
  | 'blocked'
  | 'throttled'
  | 'requires_confirmation'

export type ExecutionActionCandidate = {
  actionId: string
  decisionId: string
  entityType: 'serviceOrder' | 'charge' | 'system'
  entityId: string
  orgId: string
  mode?: ExecutionMode
  metadata?: Record<string, unknown>
}

export type ExecutionEventPayload = {
  eventType:
    | 'EXECUTION_STARTED'
    | 'EXECUTION_BLOCKED'
    | 'EXECUTION_EXECUTED'
    | 'EXECUTION_FAILED'
    | 'AUTH_BLOCKED_EXECUTION'
  entityType: string
  entityId: string
  actionId: string
  decisionId: string
  executionKey: string
  mode: ExecutionMode
  status: ExecutionRunnerStatus
  reasonCode?: string
  customerId?: string
  timestamp: string
  reasonDetail?: string
  cooldownUntil?: string
  explanation?: {
    ruleId?: string
    ruleReason?: string
    eligibility?: string
    trigger?: Record<string, unknown>
    policyKey?: string
    policyValue?: unknown
    governanceReason?: string
    cooldownUntil?: string
  }
  metadata?: Record<string, unknown>
}
