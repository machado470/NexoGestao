import { mapRiskRestriction, type ExecutionRiskContext } from "@/lib/execution/risk-governance";
import type {
  ExecutionAction,
  ExecutionActionMode,
  ExecutionLog,
  ExecutionPolicyResult,
  OperationalDecision,
} from "@/lib/execution/types";

type EvaluateExecutionPolicyInput = {
  action: ExecutionAction;
  decision: OperationalDecision;
  mode: ExecutionActionMode;
  confirmed?: boolean;
  risk?: ExecutionRiskContext;
  recentLogs: ExecutionLog[];
};

const CIRCUIT_WINDOW_MS = 1000 * 60 * 15;
const CIRCUIT_MAX_FAILURES_PER_ACTION = 3;
const CIRCUIT_MAX_FAILURES_GLOBAL = 6;

function evaluateCircuitBreaker(action: ExecutionAction, logs: ExecutionLog[]): ExecutionPolicyResult | null {
  const now = Date.now();
  const recentLogs = logs.filter((log) => now - log.executedAt <= CIRCUIT_WINDOW_MS);

  const actionFailures = recentLogs.filter(
    (log) => log.actionId === action.id && log.status === "failed"
  ).length;

  if (actionFailures >= CIRCUIT_MAX_FAILURES_PER_ACTION) {
    return {
      allowed: false,
      status: "throttled",
      reasonCode: "circuit_breaker_action_failures",
      message: "Ação temporariamente bloqueada por repetição de falhas recentes.",
    };
  }

  const globalFailures = recentLogs.filter((log) => log.status === "failed").length;
  if (globalFailures >= CIRCUIT_MAX_FAILURES_GLOBAL && action.kind === "mutation") {
    return {
      allowed: false,
      status: "throttled",
      reasonCode: "circuit_breaker_global_failures",
      message: "Mutation temporariamente bloqueada: muitas falhas em janela curta.",
    };
  }

  return null;
}

function requiresConfirmation(action: ExecutionAction, mode: ExecutionActionMode) {
  if (action.requiresConfirmation) return true;
  if (action.safetyLevel === "high") return true;
  const sensitiveAction = action.kind === "mutation" || action.kind === "external";
  if (mode === "assisted" && sensitiveAction) return true;
  return mode === "semi_automatic" && sensitiveAction && action.safetyLevel !== "low";
}

export function evaluateExecutionPolicy(input: EvaluateExecutionPolicyInput): ExecutionPolicyResult {
  const { action, decision, mode, confirmed, risk, recentLogs } = input;

  if (!action.enabled) {
    return {
      allowed: false,
      status: "blocked",
      reasonCode: "action_disabled",
      message: action.disabledReason || "Ação indisponível no momento.",
    };
  }

  if ((decision.state === "invalid" || decision.state === "blocked") && action.kind === "mutation") {
    return {
      allowed: false,
      status: "blocked",
      reasonCode: "decision_state_blocked",
      message: "Estado atual não permite executar essa mutation.",
    };
  }

  const riskRestriction = mapRiskRestriction({ action, decision, risk });
  if (riskRestriction) {
    return riskRestriction;
  }

  const circuitStatus = evaluateCircuitBreaker(action, recentLogs);
  if (circuitStatus) {
    return circuitStatus;
  }

  if (requiresConfirmation(action, mode) && !confirmed) {
    return {
      allowed: false,
      status: "requires_confirmation",
      reasonCode: "semi_automatic_requires_confirmation",
      message: "Confirme a ação antes de continuar.",
    };
  }

  if (mode === "automatic" && requiresConfirmation(action, "semi_automatic") && !confirmed) {
    return {
      allowed: false,
      status: "requires_confirmation",
      reasonCode: "automatic_requires_confirmation_policy",
      message: "Política exige confirmação para execução automática desta ação.",
    };
  }

  return {
    allowed: true,
    status: "allowed",
  };
}
