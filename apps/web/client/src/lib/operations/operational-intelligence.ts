import { normalizeStatus } from "@/lib/operations/operations.utils";

export type OperationalSeverity =
  | "pending"
  | "overdue"
  | "critical"
  | "healthy";

const SEVERITY_WEIGHT: Record<OperationalSeverity, number> = {
  critical: 0,
  overdue: 1,
  pending: 2,
  healthy: 3,
};

export function compareOperationalSeverity(
  a: OperationalSeverity,
  b: OperationalSeverity
) {
  return SEVERITY_WEIGHT[a] - SEVERITY_WEIGHT[b];
}

export function getOperationalSeverityClasses(severity: OperationalSeverity) {
  if (severity === "critical") {
    return "border-red-300 bg-red-50/90 dark:border-red-900/50 dark:bg-red-950/30";
  }
  if (severity === "overdue") {
    return "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/25 ring-1 ring-red-300/40";
  }
  if (severity === "pending") {
    return "border-amber-200 bg-amber-50/90 dark:border-amber-900/40 dark:bg-amber-950/20";
  }
  return "border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40";
}

export function getOperationalSeverityLabel(severity: OperationalSeverity) {
  if (severity === "critical") return "Crítico";
  if (severity === "overdue") return "Atrasado";
  if (severity === "pending") return "Pendente";
  return "Saudável";
}

type ServiceOrderLike = {
  status?: string | null;
  scheduledFor?: string | Date | null;
  financialSummary?: {
    hasCharge?: boolean | null;
    chargeStatus?: string | null;
  } | null;
};

type ChargeLike = {
  status?: string | null;
  dueDate?: string | Date | null;
};

type AppointmentLike = {
  status?: string | null;
  startsAt?: string | Date | null;
};

export function getServiceOrderSeverity(
  item: ServiceOrderLike
): OperationalSeverity {
  const status = normalizeStatus(item.status);
  const chargeStatus = normalizeStatus(item.financialSummary?.chargeStatus);

  if (status === "DONE" && !item.financialSummary?.hasCharge) return "critical";
  if (chargeStatus === "OVERDUE") return "overdue";
  if (status === "OPEN" || status === "ASSIGNED" || status === "IN_PROGRESS")
    return "pending";
  return "healthy";
}

export function getChargeSeverity(item: ChargeLike): OperationalSeverity {
  const status = normalizeStatus(item.status);
  if (status === "OVERDUE") return "overdue";
  if (status === "PENDING") return "pending";
  return "healthy";
}

export function getAppointmentSeverity(
  item: AppointmentLike
): OperationalSeverity {
  const status = normalizeStatus(item.status);
  const startsAt = item.startsAt ? new Date(item.startsAt) : null;
  const now = Date.now();

  if (status === "NO_SHOW") return "overdue";

  if (
    startsAt &&
    !Number.isNaN(startsAt.getTime()) &&
    startsAt.getTime() <= now &&
    (status === "SCHEDULED" || status === "CONFIRMED")
  ) {
    return "critical";
  }

  if (status === "SCHEDULED" || status === "CONFIRMED") return "pending";
  return "healthy";
}

type ServiceOrderActionLike = ServiceOrderLike & { id: string };
type ChargeActionLike = ChargeLike & {
  id: string;
  customerPhone?: string | null;
  phone?: string | null;
};
type AppointmentActionLike = AppointmentLike & { id: string };

export function getNextActionServiceOrder(item: ServiceOrderActionLike) {
  const status = normalizeStatus(item.status);
  const chargeStatus = normalizeStatus(item.financialSummary?.chargeStatus);

  if (status === "DONE" && !item.financialSummary?.hasCharge) {
    return {
      label: "Gerar cobrança",
      severity: "critical" as OperationalSeverity,
    };
  }

  if (chargeStatus === "OVERDUE") {
    return {
      label: "Cobrar cliente",
      severity: "overdue" as OperationalSeverity,
    };
  }

  if (status === "OPEN" || status === "ASSIGNED") {
    return {
      label: "Iniciar execução",
      severity: "pending" as OperationalSeverity,
    };
  }

  if (status === "IN_PROGRESS") {
    return {
      label: "Concluir serviço",
      severity: "pending" as OperationalSeverity,
    };
  }

  return {
    label: "Sem ação urgente",
    severity: "healthy" as OperationalSeverity,
  };
}

export function getNextActionCharge(item: ChargeActionLike) {
  const status = normalizeStatus(item.status);
  if (status === "OVERDUE")
    return {
      label: "Cobrar cliente",
      severity: "overdue" as OperationalSeverity,
    };
  if (status === "PENDING")
    return {
      label: "Enviar cobrança",
      severity: "pending" as OperationalSeverity,
    };
  if (status === "PAID")
    return {
      label: "Enviar comprovante",
      severity: "healthy" as OperationalSeverity,
    };
  return {
    label: "Sem ação urgente",
    severity: "healthy" as OperationalSeverity,
  };
}

export function getNextActionAppointment(item: AppointmentActionLike) {
  const status = normalizeStatus(item.status);
  const startsAt = item.startsAt ? new Date(item.startsAt) : null;
  const now = Date.now();

  if (
    startsAt &&
    !Number.isNaN(startsAt.getTime()) &&
    startsAt.getTime() <= now &&
    (status === "SCHEDULED" || status === "CONFIRMED")
  ) {
    return {
      label: "Executar serviço",
      severity: "critical" as OperationalSeverity,
    };
  }

  if (status === "SCHEDULED")
    return {
      label: "Confirmar horário",
      severity: "pending" as OperationalSeverity,
    };
  if (status === "CONFIRMED")
    return {
      label: "Executar serviço",
      severity: "pending" as OperationalSeverity,
    };
  if (status === "NO_SHOW")
    return {
      label: "Remarcar cliente",
      severity: "overdue" as OperationalSeverity,
    };
  return {
    label: "Sem ação urgente",
    severity: "healthy" as OperationalSeverity,
  };
}
