import type { ExecutionLog } from "@/lib/execution/types";

export type OperationMode = "manual" | "assisted" | "semi_automatic" | "automatic";
export type OperationOrigin = "auto" | "user";
export type ActionType = "finance" | "service_order" | "appointment" | "communication" | "governance";

export type OperationModeConfig = {
  orgMode: OperationMode;
  userMode?: OperationMode;
  actionTypeOverrides?: Partial<Record<ActionType, OperationMode>>;
};

export type OperationalActionDescriptor = {
  actionId: string;
  actionType: ActionType;
  label: string;
  isCritical?: boolean;
  explainReason: string;
  explainImpact?: string;
  explainRisk?: string;
  ruleApplied: string;
};

export type DecisionLogEntry = {
  id: string;
  actionId: string;
  actionLabel: string;
  actionType: ActionType;
  ruleApplied: string;
  reason: string;
  timestamp: string;
  origin: OperationOrigin;
  mode: OperationMode;
  status: string;
};

export type SafetyEvaluation = {
  shouldFallbackToManual: boolean;
  fallbackReason?: string;
  remainingByActionType: Record<ActionType, number>;
};

const RATE_LIMITS: Record<ActionType, number> = {
  finance: 6,
  service_order: 12,
  appointment: 10,
  communication: 14,
  governance: 8,
};

const RATE_WINDOW_MS = 1000 * 60 * 15;

export function resolveModeForAction(
  config: OperationModeConfig,
  actionType: ActionType,
): OperationMode {
  return config.actionTypeOverrides?.[actionType] ?? config.userMode ?? config.orgMode;
}

export function evaluateSafetyLimits(logs: ExecutionLog[]): SafetyEvaluation {
  const now = Date.now();
  const recentLogs = logs.filter(log => now - Number(log.executedAt ?? 0) <= RATE_WINDOW_MS);

  const usage: Record<ActionType, number> = {
    finance: 0,
    service_order: 0,
    appointment: 0,
    communication: 0,
    governance: 0,
  };

  let total = 0;
  let failed = 0;

  recentLogs.forEach(log => {
    total += 1;
    if (log.status === "failed" || log.status === "blocked") failed += 1;
    const type = mapActionTypeFromLog(log);
    usage[type] += 1;
  });

  const remainingByActionType = Object.entries(RATE_LIMITS).reduce((acc, [type, limit]) => {
    const current = usage[type as ActionType] ?? 0;
    acc[type as ActionType] = Math.max(limit - current, 0);
    return acc;
  }, {} as Record<ActionType, number>);

  const anomalousFailureRate = total >= 6 && failed / Math.max(total, 1) >= 0.4;
  const exceededRateLimit = Object.entries(usage).some(([type, count]) => count >= RATE_LIMITS[type as ActionType]);

  if (anomalousFailureRate) {
    return {
      shouldFallbackToManual: true,
      fallbackReason: "Falha fora do padrão detectada nas últimas execuções.",
      remainingByActionType,
    };
  }

  if (exceededRateLimit) {
    return {
      shouldFallbackToManual: true,
      fallbackReason: "Rate limit por tipo de ação atingido na janela operacional.",
      remainingByActionType,
    };
  }

  return {
    shouldFallbackToManual: false,
    remainingByActionType,
  };
}

export function buildDecisionLog(entries: Array<{
  action: OperationalActionDescriptor;
  mode: OperationMode;
  origin: OperationOrigin;
  status: string;
  timestamp?: string;
}>): DecisionLogEntry[] {
  return entries.map((entry, index) => ({
    id: `${entry.action.actionId}-${index}`,
    actionId: entry.action.actionId,
    actionLabel: entry.action.label,
    actionType: entry.action.actionType,
    ruleApplied: entry.action.ruleApplied,
    reason: entry.action.explainReason,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    origin: entry.origin,
    mode: entry.mode,
    status: entry.status,
  }));
}

export function mapBackendModeToOperationMode(value: string | undefined | null): OperationMode {
  const normalized = String(value ?? "manual");
  if (normalized === "automatic") return "automatic";
  if (normalized === "semi_automatic") return "semi_automatic";
  return "manual";
}

function mapActionTypeFromLog(log: ExecutionLog): ActionType {
  const telemetry = String(log.telemetryKey ?? log.actionId ?? "").toLowerCase();
  if (telemetry.includes("charge") || telemetry.includes("finance") || telemetry.includes("payment")) {
    return "finance";
  }
  if (telemetry.includes("appointment") || telemetry.includes("agenda")) {
    return "appointment";
  }
  if (telemetry.includes("whatsapp") || telemetry.includes("notification")) {
    return "communication";
  }
  if (telemetry.includes("risk") || telemetry.includes("governance")) {
    return "governance";
  }
  return "service_order";
}

export function buildCrossEntitySignals(input: {
  overdueCharges: number;
  delayedOrders: number;
  todayAppointments: number;
  totalCustomers: number;
  pausedRevenueInCents: number;
  openServiceOrders: number;
}) {
  const riskScore = Math.min(
    100,
    input.overdueCharges * 12 + input.delayedOrders * 9 + Math.round(input.pausedRevenueInCents / 100000),
  );

  const loadScore = Math.min(
    100,
    Math.round((input.todayAppointments * 5 + input.openServiceOrders * 4) / Math.max(input.totalCustomers, 1) * 100),
  );

  const priorityScore = Math.min(100, Math.round((riskScore * 0.6) + (loadScore * 0.4)));

  return {
    riskScore,
    loadScore,
    priorityScore,
    label:
      priorityScore >= 75
        ? "Alta prioridade operacional"
        : priorityScore >= 45
          ? "Prioridade moderada"
          : "Prioridade controlada",
  };
}
