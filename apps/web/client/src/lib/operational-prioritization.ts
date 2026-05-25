import {
  normalizeOperationalSeverity,
  operationalCopy,
  type OperationalActionIntent,
  type OperationalSeverity,
} from "@/lib/operational-semantics";

export type OperationalPriorityInput = {
  id?: string;
  label?: string;
  severity?: string | OperationalSeverity | null;
  dueDate?: string | Date | null;
  scheduledAt?: string | Date | null;
  amountCents?: number | null;
  hasCommunicationFailure?: boolean;
  missingOwner?: boolean;
  isBlocked?: boolean;
  customerNoResponse?: boolean;
  operationalRisk?: "critical" | "high" | "medium" | "low" | null;
  revenueImpact?: "high" | "medium" | "low" | null;
  isRestrictedAction?: boolean;
};

export type OperationalPriorityScore = {
  total: number;
  breakdown: Record<string, number>;
  severity: OperationalSeverity;
};

export type DominantOperationalAction = {
  label: string;
  reason: string;
  impact: string;
  intent: OperationalActionIntent;
  target: "customers" | "finances" | "appointments" | "service_orders" | "whatsapp" | "governance";
  href?: string;
};

// Heurísticas explícitas de priorização operacional.
const WEIGHTS = {
  severity: {
    CRITICAL: 120,
    WARNING: 90,
    ATTENTION: 60,
    NORMAL: 25,
    SUCCESS: 10,
    INACTIVE: 0,
  } satisfies Record<OperationalSeverity, number>,
  overdueBase: 70,
  overduePerDay: 4,
  appointmentIn24h: 45,
  appointmentIn72h: 25,
  financialImpactPer10kCents: 3,
  communicationFailure: 30,
  missingOwner: 22,
  blocked: 40,
  customerNoResponse: 18,
  operationalRisk: {
    critical: 50,
    high: 35,
    medium: 18,
    low: 8,
  },
  revenueImpact: {
    high: 26,
    medium: 14,
    low: 6,
  },
  restrictedAction: 20,
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function diffDaysFromNow(value: Date) {
  return Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24));
}

export function getOperationalPriorityScore(input: OperationalPriorityInput): OperationalPriorityScore {
  const severity = normalizeOperationalSeverity(input.severity ?? undefined);
  const breakdown: Record<string, number> = {
    severity: WEIGHTS.severity[severity],
  };

  const dueDate = toDate(input.dueDate);
  if (dueDate) {
    const overdueDays = diffDaysFromNow(dueDate);
    if (overdueDays > 0) {
      breakdown.overdue = WEIGHTS.overdueBase + overdueDays * WEIGHTS.overduePerDay;
    }
  }

  const scheduledAt = toDate(input.scheduledAt);
  if (scheduledAt) {
    const hoursUntil = (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil >= 0 && hoursUntil <= 24) breakdown.scheduleProximity = WEIGHTS.appointmentIn24h;
    else if (hoursUntil > 24 && hoursUntil <= 72) breakdown.scheduleProximity = WEIGHTS.appointmentIn72h;
  }

  const amount = Math.max(0, Number(input.amountCents ?? 0));
  if (amount > 0) {
    breakdown.financialImpact = Math.floor(amount / 10_000) * WEIGHTS.financialImpactPer10kCents;
  }

  if (input.hasCommunicationFailure) breakdown.communicationFailure = WEIGHTS.communicationFailure;
  if (input.missingOwner) breakdown.missingOwner = WEIGHTS.missingOwner;
  if (input.isBlocked) breakdown.blocked = WEIGHTS.blocked;
  if (input.customerNoResponse) breakdown.customerNoResponse = WEIGHTS.customerNoResponse;
  if (input.isRestrictedAction) breakdown.restrictedAction = WEIGHTS.restrictedAction;

  if (input.operationalRisk) breakdown.operationalRisk = WEIGHTS.operationalRisk[input.operationalRisk];
  if (input.revenueImpact) breakdown.revenueImpact = WEIGHTS.revenueImpact[input.revenueImpact];

  return {
    total: Object.values(breakdown).reduce((acc, value) => acc + value, 0),
    breakdown,
    severity,
  };
}

export function compareOperationalPriority(a: OperationalPriorityInput, b: OperationalPriorityInput) {
  const scoreA = getOperationalPriorityScore(a);
  const scoreB = getOperationalPriorityScore(b);
  if (scoreB.total !== scoreA.total) return scoreB.total - scoreA.total;
  return Number(b.amountCents ?? 0) - Number(a.amountCents ?? 0);
}

export function rankOperationalItems<T extends OperationalPriorityInput>(items: T[]) {
  return [...items].sort(compareOperationalPriority);
}

export function getOperationalAttentionReason(item: OperationalPriorityInput) {
  const score = getOperationalPriorityScore(item);
  const top = Object.entries(score.breakdown)
    .filter(([key]) => key !== "severity")
    .sort((a, b) => b[1] - a[1])[0];
  if (!top) return operationalCopy.immediateAttention;

  const [reason] = top;
  if (reason === "overdue") return operationalCopy.overdueBilling;
  if (reason === "communicationFailure") return operationalCopy.operationalFailure;
  if (reason === "missingOwner") return operationalCopy.missingOwner;
  if (reason === "blocked") return "Item bloqueado";
  if (reason === "scheduleProximity") return "Agendamento próximo";
  if (reason === "customerNoResponse") return operationalCopy.waitingCustomer;
  return operationalCopy.immediateAttention;
}

export function getDominantOperationalAction(items: OperationalPriorityInput[]): DominantOperationalAction | null {
  if (items.length === 0) return null;
  const top = rankOperationalItems(items)[0];
  const dueDate = toDate(top.dueDate);
  const isOverdue = dueDate ? diffDaysFromNow(dueDate) > 0 : false;

  if (isOverdue && Number(top.amountCents ?? 0) > 0) {
    return {
      label: "Cobrar cliente",
      reason: operationalCopy.overdueBilling,
      impact: "Protege caixa e reduz risco de inadimplência.",
      intent: "destructive",
      target: "finances",
      href: "/finances?status=overdue",
    };
  }
  if (top.scheduledAt) {
    return {
      label: "Confirmar agendamento",
      reason: "Agendamento próximo sem confirmação.",
      impact: "Evita no-show e perda de produtividade.",
      intent: "attention",
      target: "appointments",
      href: "/appointments?status=pending-confirmation",
    };
  }
  if (top.isBlocked) {
    return {
      label: "Destravar O.S.",
      reason: "Execução bloqueada em ordem de serviço.",
      impact: "Recupera fluxo operacional do atendimento.",
      intent: "primary",
      target: "service_orders",
      href: "/service-orders?status=attention",
    };
  }
  if (top.hasCommunicationFailure || top.customerNoResponse) {
    return {
      label: "Responder cliente",
      reason: "Canal de comunicação exige retorno.",
      impact: "Reduz atrito e acelera fechamento da pendência.",
      intent: "attention",
      target: "whatsapp",
      href: "/whatsapp",
    };
  }
  if (top.operationalRisk === "critical") {
    return {
      label: "Ver risco",
      reason: operationalCopy.criticalRisk,
      impact: "Reduz probabilidade de interrupção operacional.",
      intent: "destructive",
      target: "governance",
      href: "/governance",
    };
  }

  return {
    label: "Revisar contexto",
    reason: getOperationalAttentionReason(top),
    impact: "Mantém execução previsível no módulo.",
    intent: "contextual",
    target: "customers",
  };
}
