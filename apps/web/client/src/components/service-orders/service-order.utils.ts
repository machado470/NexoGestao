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

export function normalizeText(value?: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getPriorityLabel(priority?: number | null) {
  switch (priority) {
    case 1:
      return "Muito baixa";
    case 2:
      return "Baixa";
    case 3:
      return "Média";
    case 4:
      return "Alta";
    case 5:
      return "Urgente";
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
    case 2:
      return "text-gray-500";
    case 1:
      return "text-zinc-400";
    default:
      return "text-gray-500";
  }
}

export function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(cents?: number | null) {
  const amount = Number(cents ?? 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount / 100);
}

export function getChargeBadge(financialSummary?: FinancialSummary | null) {
  if (!financialSummary?.hasCharge || !financialSummary.chargeStatus) {
    return {
      label: "Sem cobrança",
      className:
        "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
    };
  }

  switch (financialSummary.chargeStatus) {
    case "PAID":
      return {
        label: "Cobrança paga",
        className:
          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      };
    case "OVERDUE":
      return {
        label: "Cobrança vencida",
        className:
          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      };
    case "CANCELED":
      return {
        label: "Cobrança cancelada",
        className:
          "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
      };
    case "PENDING":
    default:
      return {
        label: "Cobrança pendente",
        className:
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      };
  }
}

export function getOperationalStage(os: ServiceOrder): StageTone {
  switch (os.status) {
    case "OPEN":
      return {
        label: "Aguardando início",
        description: os.assignedToPersonId
          ? "Já possui responsável definido."
          : "Ainda sem responsável definido.",
        className:
          "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300",
        icon: CircleDashed,
      };
    case "ASSIGNED":
      return {
        label: "Aguardando execução",
        description: "Responsável definido e pronto para iniciar.",
        className:
          "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-950/20 dark:text-yellow-300",
        icon: User,
      };
    case "IN_PROGRESS":
      return {
        label: "Execução em andamento",
        description: "Serviço em execução.",
        className:
          "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-300",
        icon: Clock3,
      };
    case "DONE":
      return {
        label: "Execução concluída",
        description: "Fluxo operacional encerrado.",
        className:
          "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300",
        icon: CheckCircle2,
      };
    case "CANCELED":
    default:
      return {
        label: "Execução cancelada",
        description: "O.S. encerrada sem continuidade.",
        className:
          "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
        icon: CircleOff,
      };
  }
}

export function getFinancialStage(os: ServiceOrder): StageTone {
  const financialSummary = os.financialSummary ?? null;
  const amountDefined = Boolean(os.amountCents && os.amountCents > 0);

  if (financialSummary?.chargeStatus === "PAID") {
    return {
      label: "Fluxo financeiro fechado",
      description: "Cobrança vinculada e paga.",
      className:
        "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300",
      icon: BadgeDollarSign,
    };
  }

  if (financialSummary?.chargeStatus === "OVERDUE") {
    return {
      label: "Cobrança vencida",
      description: "Existe cobrança em atraso.",
      className:
        "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300",
      icon: AlertCircle,
    };
  }

  if (financialSummary?.chargeStatus === "PENDING") {
    return {
      label: "Cobrança pendente",
      description: "Cobrança gerada e aguardando pagamento.",
      className:
        "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-950/20 dark:text-yellow-300",
      icon: Wallet,
    };
  }

  if (financialSummary?.chargeStatus === "CANCELED") {
    return {
      label: "Cobrança cancelada",
      description: "Cobrança vinculada, mas cancelada.",
      className:
        "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
      icon: Receipt,
    };
  }

  if (os.status === "DONE" && amountDefined) {
    return {
      label: "Pronta para cobrança",
      description: "Execução finalizada com valor definido.",
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300",
      icon: ArrowRightLeft,
    };
  }

  if (os.status === "DONE" && !amountDefined) {
    return {
      label: "Sem valor definido",
      description: "Concluída, mas sem base financeira suficiente.",
      className:
        "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300",
      icon: AlertCircle,
    };
  }

  return {
    label: "Financeiro ainda não iniciado",
    description: "A etapa financeira depende do fechamento operacional.",
    className:
      "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
    icon: Wallet,
  };
}

export function getFinancialFilterLabel(value: FinancialFilter) {
  switch (value) {
    case "ALL":
      return "Todos os estados financeiros";
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
      return value;
  }
}

export function matchesFinancialFilter(
  os: ServiceOrder,
  filter: FinancialFilter
) {
  if (filter === "ALL") return true;

  const summary = os.financialSummary ?? null;
  const amountDefined = Boolean(os.amountCents && os.amountCents > 0);

  if (filter === "NO_CHARGE") {
    return !summary?.hasCharge;
  }

  if (filter === "READY_TO_CHARGE") {
    return os.status === "DONE" && amountDefined && !summary?.hasCharge;
  }

  return summary?.chargeStatus === filter;
}

export function getServiceOrderIdFromUrl() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const serviceOrderId = params.get("serviceOrderId")?.trim() ?? "";

  return serviceOrderId || null;
}

export function buildServiceOrdersUrl(serviceOrderId?: string | null) {
  const params = new URLSearchParams();

  if (serviceOrderId) {
    params.set("serviceOrderId", serviceOrderId);
  }

  const query = params.toString();
  return query ? `/service-orders?${query}` : "/service-orders";
}
