export type ExecutionActionKind = "navigate" | "external" | "mutation" | "future";

export type ExecutionActionIntent = "primary" | "secondary" | "danger";

export type ExecutionSeverity = "normal" | "warning" | "critical";

export type ExecutionState = "ready" | "blocked" | "invalid" | "completed";

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
  status: "executed" | "blocked" | "unsupported" | "failed";
  message?: string;
};

export type ExecuteActionContext = {
  source: ExecutionSource;
  decisionId?: string;
};
