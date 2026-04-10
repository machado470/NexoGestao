export type ExecutionActionKind = "navigate" | "external" | "mutation" | "future";

export type ExecutionActionIntent = "primary" | "secondary" | "danger";

export type ExecutionSeverity = "normal" | "warning" | "critical";

export type ExecutionState = "ready" | "blocked" | "invalid" | "completed";

export type ExecutionActionMode = "manual" | "assisted" | "semi_automatic" | "automatic";

export type ExecutionPolicyStatus =
  | "allowed"
  | "blocked"
  | "requires_confirmation"
  | "throttled"
  | "restricted";

export type ExecutionEventType =
  | "EXECUTION_ACTION_REQUESTED"
  | "EXECUTION_ACTION_EXECUTED"
  | "EXECUTION_ACTION_FAILED"
  | "EXECUTION_ACTION_BLOCKED";

export type OperationalEntityType =
  | "customer"
  | "appointment"
  | "serviceOrder"
  | "charge"
  | "payment"
  | "system";

export type ExecutionSource =
  | "dashboard"
  | "workflow"
  | "whatsapp"
  | "finance"
  | "governance";

export type ExecutionAction = {
  id: string;
  kind: ExecutionActionKind;
  intent: ExecutionActionIntent;
  label: string;
  description?: string;
  enabled: boolean;
  disabledReason?: string;
  target?: string;
  externalUrl?: string;
  mutationKey?: string;
  payload?: Record<string, unknown>;
  telemetryKey: string;
  mode: ExecutionActionMode;
  safetyLevel?: "low" | "medium" | "high";
  requiresConfirmation?: boolean;
  autoWhenPossible?: boolean;
};

export type OperationalDecision = {
  id: string;
  entityType: OperationalEntityType;
  entityId: string;
  severity: ExecutionSeverity;
  state: ExecutionState;
  title: string;
  summary: string;
  reasonCodes: string[];
  actions: ExecutionAction[];
  suggestedActionId?: string;
  priority?: number;
  impactScore?: number;
  urgencyScore?: number;
  contextualPriority?: "low" | "medium" | "high" | "critical";
};

export type ExecutionPlan = {
  id: string;
  source: ExecutionSource;
  decisions: OperationalDecision[];
};

export type ExecuteActionResult = {
  ok: boolean;
  status:
    | "executed"
    | "blocked"
    | "requires_confirmation"
    | "throttled"
    | "restricted"
    | "unsupported"
    | "failed";
  message?: string;
  reasonCode?: string;
};

export type ExecutionLogStatus =
  | "success"
  | "failed"
  | "pending"
  | "blocked"
  | "throttled"
  | "restricted"
  | "requires_confirmation";

export type ExecutionLog = {
  id: string;
  actionId: string;
  decisionId: string;
  executionKey?: string;
  executedAt: number;
  timestamp?: string;
  status: ExecutionLogStatus;
  entityType?: OperationalEntityType;
  entityId?: string;
  mode?: ExecutionActionMode;
  eventType?: ExecutionEventType;
  reasonCode?: string;
  message?: string;
  telemetryKey?: string;
};

export type ExecutionStateSummary = {
  pending: number;
  executed: number;
  failed: number;
  blocked: number;
  throttled: number;
};

export type ExecuteActionContext = {
  source: ExecutionSource;
  decisionId?: string;
};

export type RiskOperationalState =
  | "NORMAL"
  | "WARNING"
  | "RESTRICTED"
  | "SUSPENDED"
  | "UNKNOWN";

export type ExecutionPolicyResult = {
  allowed: boolean;
  status: ExecutionPolicyStatus;
  reasonCode?: string;
  message?: string;
};
