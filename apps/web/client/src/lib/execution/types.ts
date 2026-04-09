export type ExecutionActionKind = "navigate" | "external" | "mutation" | "future";

export type ExecutionActionIntent = "primary" | "secondary" | "danger";

export type ExecutionSeverity = "normal" | "warning" | "critical";

export type ExecutionState = "ready" | "blocked" | "invalid" | "completed";

export type ExecutionActionMode = "manual" | "semi_automatic" | "automatic";

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
  | "restricted";

export type ExecutionLog = {
  id: string;
  actionId: string;
  decisionId: string;
  executionKey?: string;
  executedAt: number;
  status: ExecutionLogStatus;
  entityType?: OperationalEntityType;
  entityId?: string;
  mode?: ExecutionActionMode;
  eventType?: ExecutionEventType;
  reasonCode?: string;
  message?: string;
  telemetryKey?: string;
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
