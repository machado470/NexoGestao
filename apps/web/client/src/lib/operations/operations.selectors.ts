import type {
  ServiceOrder,
  FinancialFilter,
  StageTone,
} from "@/components/service-orders/service-order.types";
import { normalizeStatus } from "@/lib/operations/operations.utils";
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
} from "lucide-react";

type StatusLike = {
  status?: string | null;
};

export function getOrdersInStatuses<T extends StatusLike>(
  orders: T[],
  statuses: string[]
) {
  const allowed = new Set(statuses.map((status) => normalizeStatus(status)));
  return orders.filter((order) => allowed.has(normalizeStatus(order.status)));
}

export function getPendingCharges<T extends StatusLike>(charges: T[]) {
  return charges.filter(
    (charge) => normalizeStatus(charge.status) === "PENDING"
  );
}

export function getOverdueCharges<T extends StatusLike>(charges: T[]) {
  return charges.filter(
    (charge) => normalizeStatus(charge.status) === "OVERDUE"
  );
}

export function getDoneWithoutCharge(orders: ServiceOrder[]) {
  return orders.filter(
    (os) => os.status === "DONE" && !os.financialSummary?.hasCharge
  );
}

export function sumAmountCents(items: { amountCents?: number | null }[]) {
  return items.reduce((acc, item) => acc + (item.amountCents ?? 0), 0);
}

export function getPriorityScore(os: ServiceOrder) {
  return Number(os.priority ?? 0);
}

export function matchesFinancialFilter(
  os: ServiceOrder,
  filter: FinancialFilter
) {
  const summary = os.financialSummary;

  if (filter === "ALL") return true;

  if (filter === "NO_CHARGE") {
    return !summary?.hasCharge;
  }

  if (filter === "READY_TO_CHARGE") {
    return os.status === "DONE" && !summary?.hasCharge;
  }

  if (!summary?.hasCharge) return false;

  if (filter === "PENDING") return summary.chargeStatus === "PENDING";
  if (filter === "PAID") return summary.chargeStatus === "PAID";
  if (filter === "OVERDUE") return summary.chargeStatus === "OVERDUE";
  if (filter === "CANCELED") return summary.chargeStatus === "CANCELED";

  return true;
}

export function getChargeBadge(summary?: ServiceOrder["financialSummary"]) {
  if (!summary?.hasCharge) {
    return {
      label: "Sem cobrança",
      className: "bg-gray-100 text-gray-700",
    };
  }

  const status = summary.chargeStatus;

  if (status === "PAID") {
    return {
      label: "Pago",
      className: "bg-green-100 text-green-700",
    };
  }

  if (status === "OVERDUE") {
    return {
      label: "Vencido",
      className: "bg-red-100 text-red-700",
    };
  }

  if (status === "CANCELED") {
    return {
      label: "Cancelado",
      className: "bg-gray-200 text-gray-700",
    };
  }

  return {
    label: "Pendente",
    className: "bg-amber-100 text-amber-700",
  };
}

export function getOperationalStage(os: ServiceOrder): StageTone {
  if (os.status === "OPEN" || os.status === "ASSIGNED") {
    return {
      label: "Não iniciado",
      description: "Aguardando início da execução.",
      className: "border-amber-400 text-amber-700",
      icon: Clock3,
    };
  }

  if (os.status === "IN_PROGRESS") {
    return {
      label: "Em execução",
      description: "Serviço em andamento.",
      className: "border-blue-400 text-blue-700",
      icon: AlertCircle,
    };
  }

  if (os.status === "DONE") {
    return {
      label: "Concluído",
      description: "Execução finalizada.",
      className: "border-green-400 text-green-700",
      icon: CheckCircle2,
    };
  }

  return {
    label: "Outro",
    description: "Status fora do fluxo principal.",
    className: "border-gray-400 text-gray-700",
    icon: AlertCircle,
  };
}

export function getFinancialStage(os: ServiceOrder): StageTone {
  const summary = os.financialSummary;

  if (!summary?.hasCharge) {
    return {
      label: "Sem cobrança",
      description: "Ainda não existe cobrança vinculada.",
      className: "border-gray-400 text-gray-700",
      icon: CircleDollarSign,
    };
  }

  if (summary.chargeStatus === "PAID") {
    return {
      label: "Recebido",
      description: "Pagamento concluído.",
      className: "border-green-400 text-green-700",
      icon: CheckCircle2,
    };
  }

  if (summary.chargeStatus === "OVERDUE") {
    return {
      label: "Atrasado",
      description: "Cobrança vencida.",
      className: "border-red-400 text-red-700",
      icon: AlertCircle,
    };
  }

  if (summary.chargeStatus === "CANCELED") {
    return {
      label: "Cancelado",
      description: "Cobrança cancelada.",
      className: "border-gray-400 text-gray-700",
      icon: AlertCircle,
    };
  }

  return {
    label: "A receber",
    description: "Cobrança criada aguardando pagamento.",
    className: "border-amber-400 text-amber-700",
    icon: Clock3,
  };
}

export function getServiceOrderFlowSteps(os: ServiceOrder) {
  const hasCharge = Boolean(os.financialSummary?.hasCharge);
  const chargeStatus = os.financialSummary?.chargeStatus ?? null;

  return [
    {
      key: "start",
      label: "Iniciar execução",
      done: ["IN_PROGRESS", "DONE"].includes(os.status),
      active: ["OPEN", "ASSIGNED"].includes(os.status),
    },
    {
      key: "finish",
      label: "Finalizar execução",
      done: os.status === "DONE",
      active: os.status === "IN_PROGRESS",
    },
    {
      key: "charge",
      label: "Gerar cobrança",
      done: hasCharge,
      active: os.status === "DONE" && !hasCharge,
    },
    {
      key: "payment",
      label: "Receber pagamento",
      done: chargeStatus === "PAID",
      active: hasCharge && chargeStatus !== "PAID",
    },
  ];
}

export function getServiceOrderNextAction(os: ServiceOrder) {
  if (os.financialSummary?.chargeStatus === "OVERDUE") {
    return {
      tone: "red",
      title: "Cobrar cliente imediatamente",
      description: "Existe cobrança vencida exigindo ação urgente.",
    };
  }

  if (["OPEN", "ASSIGNED"].includes(os.status)) {
    return {
      tone: "amber",
      title: "Iniciar execução",
      description: "A ordem ainda não foi iniciada.",
    };
  }

  if (os.status === "IN_PROGRESS") {
    return {
      tone: "blue",
      title: "Finalizar execução",
      description: "A execução precisa ser concluída.",
    };
  }

  if (os.status === "DONE" && !os.financialSummary?.hasCharge) {
    return {
      tone: "red",
      title: "Gerar cobrança",
      description: "Serviço concluído sem cobrança vinculada.",
    };
  }

  if (
    os.financialSummary?.hasCharge &&
    os.financialSummary?.chargeStatus === "PENDING"
  ) {
    return {
      tone: "amber",
      title: "Receber pagamento",
      description:
        "Cobrança pendente. Gere checkout, registre pagamento ou cobre via WhatsApp.",
    };
  }

  if (os.financialSummary?.chargeStatus === "PAID") {
    return {
      tone: "green",
      title: "Fluxo concluído",
      description: "Execução e financeiro finalizados.",
    };
  }

  return {
    tone: "gray",
    title: "Sem ação imediata",
    description: "Nenhuma ação necessária no momento.",
  };
}
