import {
  AlertCircle,
  ArrowRightLeft,
  BadgeDollarSign,
  CheckCircle2,
  CircleDashed,
  CircleOff,
  Clock3,
  Receipt,
  User,
  Wallet,
} from "lucide-react";
import type {
  FinancialFilter,
  FinancialSummary,
  ServiceOrder,
  ServiceOrderStatus,
  StageTone,
} from "./service-order.types";

/* =========================
   STATUS
========================= */

export const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  OPEN: "Aberta",
  ASSIGNED: "Atribuída",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluída",
  CANCELED: "Cancelada",
};

export const STATUS_COLORS: Record<ServiceOrderStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  ASSIGNED:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  IN_PROGRESS:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  CANCELED: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
};

/* =========================
   TEXTO / FORMATOS
========================= */

export function normalizeText(value?: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

export function formatCurrency(cents?: number | null) {
  const amount = Number(cents ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount / 100);
}

/* =========================
   PRIORIDADE
========================= */

export function getPriorityLabel(priority?: number | null) {
  switch (priority) {
    case 5:
      return "Urgente";
    case 4:
      return "Alta";
    case 3:
      return "Média";
    case 2:
      return "Baixa";
    case 1:
      return "Muito baixa";
    default:
      return "Baixa";
  }
}

export function getPriorityColor(priority?: number | null) {
  switch (priority) {
    case 5:
      return "text-red-500";
    case 4:
      return "text-orange-500";
    case 3:
      return "text-blue-500";
    default:
      return "text-gray-500";
  }
}

/* =========================
   ATIVIDADE / INTELIGÊNCIA
========================= */

export function getLastActivityAt(os: ServiceOrder) {
  return (
    os.updatedAt ||
    os.finishedAt ||
    os.startedAt ||
    os.scheduledFor ||
    os.createdAt ||
    null
  );
}

export function getHoursSinceActivity(os: ServiceOrder) {
  const date = getLastActivityAt(os);
  if (!date) return 999;
  return (Date.now() - new Date(date).getTime()) / 3600000;
}

export function isAbandoned(os: ServiceOrder) {
  const hours = getHoursSinceActivity(os);
  return ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(os.status) && hours > 48;
}

export function getPriorityScore(os: ServiceOrder) {
  const hasCharge = os.financialSummary?.hasCharge;
  const hasValue = Boolean(os.amountCents && os.amountCents > 0);

  if (os.status === "DONE" && hasValue && !hasCharge) return 1000;
  if (isAbandoned(os)) return 900;
  if (os.status === "IN_PROGRESS") return 700;
  if (os.status === "ASSIGNED") return 500;
  if (os.status === "OPEN") return 400;
  if (os.status === "DONE") return 200;
  if (os.status === "CANCELED") return 0;

  return 100;
}

/* =========================
   FINANCEIRO
========================= */

export function getChargeBadge(financialSummary?: FinancialSummary | null) {
  if (!financialSummary?.hasCharge || !financialSummary.chargeStatus) {
    return {
      label: "Sem cobrança",
      className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    };
  }

  switch (financialSummary.chargeStatus) {
    case "PAID":
      return {
        label: "Cobrança paga",
        className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      };
    case "OVERDUE":
      return {
        label: "Cobrança vencida",
        className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      };
    case "CANCELED":
      return {
        label: "Cobrança cancelada",
        className: "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
      };
    default:
      return {
        label: "Cobrança pendente",
        className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      };
  }
}

export function getFinancialFilterLabel(filter: FinancialFilter) {
  switch (filter) {
    case "ALL":
      return "Todos";
    case "NO_CHARGE":
      return "Sem cobrança";
    case "READY_TO_CHARGE":
      return "Prontas para cobrança";
    case "PENDING":
      return "Cobrança pendente";
    case "PAID":
      return "Cobrança paga";
    case "OVERDUE":
      return "Cobrança vencida";
    case "CANCELED":
      return "Cobrança cancelada";
    default:
      return "Todos";
  }
}

export function matchesFinancialFilter(
  os: ServiceOrder,
  filter: FinancialFilter
) {
  if (filter === "ALL") return true;

  const summary = os.financialSummary ?? null;
  const amountDefined = Boolean(os.amountCents && os.amountCents > 0);

  if (filter === "NO_CHARGE") return !summary?.hasCharge;

  if (filter === "READY_TO_CHARGE") {
    return os.status === "DONE" && amountDefined && !summary?.hasCharge;
  }

  return summary?.chargeStatus === filter;
}

/* =========================
   STAGES / HUB OPERACIONAL
========================= */

export function getOperationalStage(os: ServiceOrder): StageTone {
  const hasAssignedPerson = Boolean(os.assignedToPersonId);
  const abandoned = isAbandoned(os);

  if (os.status === "CANCELED") {
    return {
      label: "Cancelada",
      description: "O fluxo operacional foi encerrado por cancelamento.",
      className:
        "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
      icon: CircleOff,
    };
  }

  if (os.status === "DONE") {
    return {
      label: "Concluída",
      description: "Execução finalizada e pronta para leitura de fechamento.",
      className:
        "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
      icon: CheckCircle2,
    };
  }

  if (os.status === "IN_PROGRESS") {
    return {
      label: abandoned ? "Em risco" : "Em execução",
      description: abandoned
        ? "Execução iniciada, mas sem atividade recente."
        : "Serviço em andamento agora.",
      className: abandoned
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
        : "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
      icon: abandoned ? AlertCircle : Clock3,
    };
  }

  if (os.status === "ASSIGNED") {
    return {
      label: "Atribuída",
      description: hasAssignedPerson
        ? "Responsável definido, aguardando início da execução."
        : "Status atribuído sem responsável válido.",
      className: hasAssignedPerson
        ? "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-300"
        : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
      icon: hasAssignedPerson ? User : AlertCircle,
    };
  }

  return {
    label: "Aberta",
    description: "O.S. criada e aguardando responsável ou avanço operacional.",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300",
    icon: CircleDashed,
  };
}

export function getFinancialStage(os: ServiceOrder): StageTone {
  const summary = os.financialSummary ?? null;
  const hasValue = Boolean(os.amountCents && os.amountCents > 0);
  const readyToCharge =
    os.status === "DONE" && hasValue && !summary?.hasCharge;

  if (summary?.hasCharge && summary.chargeStatus === "PAID") {
    return {
      label: "Pago",
      description: "Cobrança quitada. Ciclo financeiro encerrado.",
      className:
        "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
      icon: BadgeDollarSign,
    };
  }

  if (summary?.hasCharge && summary.chargeStatus === "OVERDUE") {
    return {
      label: "Vencido",
      description: "Cobrança emitida, mas está em atraso.",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
      icon: AlertCircle,
    };
  }

  if (summary?.hasCharge && summary.chargeStatus === "CANCELED") {
    return {
      label: "Cobrança cancelada",
      description: "Houve cobrança, mas ela foi cancelada.",
      className:
        "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
      icon: CircleOff,
    };
  }

  if (summary?.hasCharge && summary.chargeStatus === "PENDING") {
    return {
      label: "Cobrando",
      description: "Cobrança emitida e aguardando pagamento.",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300",
      icon: Wallet,
    };
  }

  if (readyToCharge) {
    return {
      label: "Pronta para cobrança",
      description: "Execução concluída com valor, mas a cobrança ainda não nasceu.",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
      icon: Receipt,
    };
  }

  if (hasValue) {
    return {
      label: "Sem cobrança",
      description: "Há valor na O.S., mas ainda sem etapa financeira ativa.",
      className:
        "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
      icon: ArrowRightLeft,
    };
  }

  return {
    label: "Sem impacto financeiro",
    description: "A O.S. ainda não gerou leitura financeira relevante.",
    className:
      "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
    icon: CircleDashed,
  };
}

/* =========================
   URL
========================= */

export function getServiceOrderIdFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("serviceOrderId") || null;
}

export function buildServiceOrdersUrl(serviceOrderId?: string | null) {
  const params = new URLSearchParams();
  if (serviceOrderId) params.set("serviceOrderId", serviceOrderId);

  return params.toString() ? `/service-orders?${params}` : "/service-orders";
}
