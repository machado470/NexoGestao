import type {
  ExecutionAction,
  ExecutionPolicyResult,
  OperationalDecision,
  RiskOperationalState,
} from "@/lib/execution/types";

export type ExecutionRiskContext = {
  operationalState?: RiskOperationalState;
};

function isSensitiveAction(action: ExecutionAction) {
  return action.kind === "mutation" || action.kind === "external" || action.intent === "danger";
}

function isCriticalDecision(decision: OperationalDecision) {
  return decision.severity === "critical" || decision.reasonCodes.includes("cashflow_risk");
}

export function mapRiskRestriction(input: {
  action: ExecutionAction;
  decision: OperationalDecision;
  risk?: ExecutionRiskContext;
}): ExecutionPolicyResult | null {
  const operationalState = input.risk?.operationalState ?? "UNKNOWN";

  if (operationalState === "SUSPENDED" && isCriticalDecision(input.decision) && isSensitiveAction(input.action)) {
    return {
      allowed: false,
      status: "blocked",
      reasonCode: "risk_suspended_critical_action",
      message: "Execução bloqueada: operação em estado SUSPENDED para ações críticas.",
    };
  }

  if (operationalState === "RESTRICTED" && isSensitiveAction(input.action)) {
    return {
      allowed: false,
      status: "restricted",
      reasonCode: "risk_restricted_sensitive_action",
      message: "Execução restrita por governança: ação sensível exige liberação.",
    };
  }

  return null;
}
