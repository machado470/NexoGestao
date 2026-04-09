export type ExecutionMode = 'manual' | 'semi_automatic' | 'automatic'

export type ExecutionPolicyConfig = {
  allowAutomaticCharge: boolean
  allowWhatsAppAuto: boolean
  allowOverdueReminderAuto: boolean
  allowFinanceTeamNotifications: boolean
  allowGovernanceFollowup: boolean
  maxRetries: number
  throttleWindowMs: number
}

export type ExecutionStateSummary = {
  pending: number
  executed: number
  failed: number
  blocked: number
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
  eventType: 'EXECUTION_ACTION_REQUESTED' | 'EXECUTION_ACTION_EXECUTED' | 'EXECUTION_ACTION_FAILED' | 'EXECUTION_ACTION_BLOCKED'
  entityType: string
  entityId: string
  actionId: string
  decisionId: string
  executionKey: string
  mode: ExecutionMode
  status: ExecutionRunnerStatus
  reasonCode?: string
  timestamp: string
  metadata?: Record<string, unknown>
}
