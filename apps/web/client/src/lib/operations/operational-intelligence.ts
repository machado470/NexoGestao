import {
  normalizeStatus,
  buildOperationalContextFromCharge,
  buildOperationalContextFromServiceOrder,
} from "@/lib/operations/operations.utils";

export type OperationalSeverity =
  | "pending"
  | "overdue"
  | "critical"
  | "healthy";

export type OperationalEntity =
  | "service_order"
  | "charge"
  | "appointment"
  | "customer";

export type OperationalActionKey =
  | "open_queue"
  | "open_service_order"
  | "create_service_order"
  | "generate_charge"
  | "open_finances"
  | "open_whatsapp"
  | "confirm_appointment"
  | "reschedule_appointment"
  | "review_execution"
  | "open_customer"
  | "create_appointment";

export type OperationalActionPlan = {
  key: OperationalActionKey;
  label: string;
};

export type InvalidOperationalState = {
  code:
    | "service_order_done_without_charge"
    | "appointment_done_without_service_order"
    | "charge_overdue_without_customer";
  title: string;
  description: string;
  fixAction: OperationalActionPlan;
};

export type OperationalDecision = {
  severity: OperationalSeverity;
  title: string;
  description: string;
  primaryAction: OperationalActionPlan;
  secondaryActions: OperationalActionPlan[];
  invalidState?: InvalidOperationalState;
};

const SEVERITY_WEIGHT: Record<OperationalSeverity, number> = {
  critical: 0,
  overdue: 1,
  pending: 2,
  healthy: 3,
};

export const SERVICE_ORDER_TRANSITIONS = {
  OPEN: ["ASSIGNED", "IN_PROGRESS", "CANCELED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["DONE", "CANCELED"],
  DONE: [],
  CANCELED: [],
} as const;

export const CHARGE_TRANSITIONS = {
  PENDING: ["PAID", "OVERDUE", "CANCELED"],
  OVERDUE: ["PAID", "CANCELED"],
  PAID: [],
  CANCELED: [],
} as const;

export const APPOINTMENT_TRANSITIONS = {
  SCHEDULED: ["CONFIRMED", "DONE", "NO_SHOW", "CANCELED"],
  CONFIRMED: ["DONE", "NO_SHOW", "CANCELED"],
  DONE: [],
  CANCELED: [],
  NO_SHOW: [],
} as const;

export function compareOperationalSeverity(
  a: OperationalSeverity,
  b: OperationalSeverity
) {
  return SEVERITY_WEIGHT[a] - SEVERITY_WEIGHT[b];
}

export function getOperationalSeverityClasses(severity: OperationalSeverity) {
  if (severity === "critical") {
    return "border-red-400 bg-red-50/95 dark:border-red-800/70 dark:bg-red-950/35 ring-2 ring-red-300/40";
  }
  if (severity === "overdue") {
    return "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/25 ring-1 ring-red-300/40";
  }
  if (severity === "pending") {
    return "border-amber-200 bg-amber-50/90 dark:border-amber-900/40 dark:bg-amber-950/20";
  }
  return "border-[var(--border-subtle)] bg-zinc-50/80 dark:border-zinc-800 dark:bg-[var(--surface-base)]/40";
}

export function getOperationalSeverityLabel(severity: OperationalSeverity) {
  if (severity === "critical") return "Crítico";
  if (severity === "overdue") return "Atrasado";
  if (severity === "pending") return "Pendente";
  return "Saudável";
}

type ServiceOrderLike = {
  id?: string;
  status?: string | null;
  customerId?: string | null;
  scheduledFor?: string | Date | null;
  financialSummary?: {
    hasCharge?: boolean | null;
    chargeStatus?: string | null;
    chargeId?: string | null;
  } | null;
};

type ChargeLike = {
  id?: string;
  status?: string | null;
  customerId?: string | null;
  dueDate?: string | Date | null;
};

type AppointmentLike = {
  id?: string;
  status?: string | null;
  startsAt?: string | Date | null;
};

type CustomerLike = {
  id?: string;
  active?: boolean | null;
  openServiceOrders?: number;
  pendingCharges?: number;
  overdueCharges?: number;
  lastInteractionAt?: string | Date | null;
};

export function getServiceOrderSeverity(item: ServiceOrderLike): OperationalSeverity {
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

export function getAppointmentSeverity(item: AppointmentLike): OperationalSeverity {
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

export function getNextActionServiceOrder(item: ServiceOrderLike) {
  const decision = getServiceOrderDecision(item);
  return {
    label: decision.primaryAction.label,
    severity: decision.severity,
  };
}

export function getNextActionCharge(item: ChargeLike) {
  const decision = getChargeDecision(item);
  return {
    label: decision.primaryAction.label,
    severity: decision.severity,
  };
}

export function getNextActionAppointment(item: AppointmentLike) {
  const decision = getAppointmentDecision({ appointment: item });
  return {
    label: decision.primaryAction.label,
    severity: decision.severity,
  };
}

export function getCustomerSeverity(item: CustomerLike): OperationalSeverity {
  const hasOverdue = (item.overdueCharges ?? 0) > 0;
  const hasPending = (item.pendingCharges ?? 0) > 0;
  const hasOpenOrders = (item.openServiceOrders ?? 0) > 0;
  const isInactive = item.active === false;

  if (hasOverdue) return "critical";
  if (isInactive) return "overdue";
  if (hasPending || hasOpenOrders) return "pending";
  return "healthy";
}

export function getNextActionCustomer(item: CustomerLike) {
  const decision = getCustomerDecision(item);
  return {
    label: decision.primaryAction.label,
    severity: decision.severity,
  };
}

export function getServiceOrderDecision(item: ServiceOrderLike): OperationalDecision {
  const status = normalizeStatus(item.status);
  const chargeStatus = normalizeStatus(item.financialSummary?.chargeStatus);

  if (status === "DONE" && !item.financialSummary?.hasCharge) {
    return {
      severity: "critical",
      title: "Gerar cobrança desta O.S.",
      description: "Execução concluída sem cobrança vinculada bloqueia entrada de caixa.",
      primaryAction: { key: "generate_charge", label: "Gerar cobrança" },
      secondaryActions: [
        { key: "open_service_order", label: "Revisar execução" },
      ],
      invalidState: {
        code: "service_order_done_without_charge",
        title: "Estado inválido detectado",
        description: "O.S. concluída sem cobrança. Corrija para fechar o ciclo operacional.",
        fixAction: { key: "generate_charge", label: "Corrigir: gerar cobrança" },
      },
    };
  }

  if (chargeStatus === "OVERDUE") {
    return {
      severity: "critical",
      title: "Cobrança vencida: acionar cliente",
      description: "A cobrança está vencida e precisa de recuperação imediata.",
      primaryAction: { key: "open_whatsapp", label: "Cobrar no WhatsApp" },
      secondaryActions: [{ key: "open_finances", label: "Abrir financeiro" }],
    };
  }

  if (status === "OPEN" || status === "ASSIGNED") {
    return {
      severity: "pending",
      title: "Iniciar execução",
      description: "A ordem está pronta para execução e precisa avançar no fluxo.",
      primaryAction: { key: "open_service_order", label: "Iniciar agora" },
      secondaryActions: [{ key: "open_queue", label: "Ver fila" }],
    };
  }

  if (status === "IN_PROGRESS") {
    return {
      severity: "pending",
      title: "Concluir execução",
      description: "Feche a entrega para habilitar faturamento e evitar retrabalho.",
      primaryAction: { key: "review_execution", label: "Revisar e concluir" },
      secondaryActions: [{ key: "open_queue", label: "Ver fila" }],
    };
  }

  return {
    severity: "healthy",
    title: "Fluxo sem urgência",
    description: "Sem bloqueio crítico no momento.",
    primaryAction: { key: "open_queue", label: "Revisar fila" },
    secondaryActions: [],
  };
}

export function getChargeDecision(item: ChargeLike): OperationalDecision {
  const status = normalizeStatus(item.status);

  if (status === "OVERDUE") {
    const missingCustomer = !item.customerId;
    return {
      severity: "overdue",
      title: "Recuperar cobrança vencida",
      description: "Cobrança vencida com impacto direto no caixa do dia.",
      primaryAction: { key: "open_whatsapp", label: "Recuperar no WhatsApp" },
      secondaryActions: [{ key: "open_finances", label: "Abrir financeiro" }],
      invalidState: missingCustomer
        ? {
            code: "charge_overdue_without_customer",
            title: "Estado inválido detectado",
            description: "Cobrança vencida sem cliente vinculado impede recuperação rápida.",
            fixAction: { key: "open_finances", label: "Corrigir cobrança" },
          }
        : undefined,
    };
  }

  if (status === "PENDING") {
    return {
      severity: "pending",
      title: "Acompanhar cobrança pendente",
      description: "Sem urgência crítica, mas requer follow-up para não virar atraso.",
      primaryAction: { key: "open_whatsapp", label: "Enviar lembrete" },
      secondaryActions: [{ key: "open_finances", label: "Abrir financeiro" }],
    };
  }

  return {
    severity: "healthy",
    title: "Cobrança regular",
    description: "Cobrança sem pendência operacional imediata.",
    primaryAction: { key: "open_finances", label: "Ver financeiro" },
    secondaryActions: [],
  };
}

export function getAppointmentDecision(params: {
  appointment: AppointmentLike;
  hasServiceOrder?: boolean;
  hasPendingFinancial?: boolean;
}): OperationalDecision {
  const { appointment, hasServiceOrder = false, hasPendingFinancial = false } = params;
  const status = normalizeStatus(appointment.status);

  if (status === "NO_SHOW") {
    return {
      severity: "overdue",
      title: "Retomar contato",
      description: "Cliente faltou. Reative a conversa para remarcar e preservar receita.",
      primaryAction: { key: "reschedule_appointment", label: "Remarcar cliente" },
      secondaryActions: [{ key: "open_whatsapp", label: "Chamar no WhatsApp" }],
    };
  }

  if (status === "SCHEDULED") {
    return {
      severity: "pending",
      title: "Confirmar agendamento",
      description: "Confirme presença para reduzir risco de no-show.",
      primaryAction: { key: "confirm_appointment", label: "Confirmar horário" },
      secondaryActions: [{ key: "open_whatsapp", label: "Avisar no WhatsApp" }],
    };
  }

  if (status === "CONFIRMED" && !hasServiceOrder) {
    return {
      severity: "critical",
      title: "Abrir execução",
      description: "Agendamento confirmado sem O.S. ativa interrompe o fluxo operacional.",
      primaryAction: { key: "create_service_order", label: "Criar O.S." },
      secondaryActions: [{ key: "open_whatsapp", label: "Confirmar com cliente" }],
    };
  }

  if (status === "DONE" && !hasServiceOrder) {
    return {
      severity: "critical",
      title: "Consolidar execução",
      description: "Agendamento concluído sem O.S. vinculada gera lacuna operacional.",
      primaryAction: { key: "create_service_order", label: "Criar O.S. retroativa" },
      secondaryActions: [{ key: "open_queue", label: "Revisar agenda" }],
      invalidState: {
        code: "appointment_done_without_service_order",
        title: "Estado inválido detectado",
        description: "Atendimento marcado como concluído sem ordem de serviço correspondente.",
        fixAction: { key: "create_service_order", label: "Corrigir: criar O.S." },
      },
    };
  }

  if (status === "DONE" && hasPendingFinancial) {
    return {
      severity: "critical",
      title: "Fechar financeiro",
      description: "Atendimento concluído com pendência financeira em aberto.",
      primaryAction: { key: "open_finances", label: "Cobrar agora" },
      secondaryActions: [{ key: "open_service_order", label: "Revisar execução" }],
    };
  }

  if (status === "CONFIRMED" && hasServiceOrder) {
    return {
      severity: "pending",
      title: "Acompanhar execução",
      description: "Há O.S. vinculada. Próximo passo é conduzir entrega até conclusão.",
      primaryAction: { key: "open_service_order", label: "Abrir O.S." },
      secondaryActions: [{ key: "open_whatsapp", label: "Retomar conversa" }],
    };
  }

  return {
    severity: "healthy",
    title: "Sem ação imediata",
    description: "Nenhum bloqueio operacional crítico identificado.",
    primaryAction: { key: "open_queue", label: "Ver agenda" },
    secondaryActions: [{ key: "open_whatsapp", label: "Retomar no WhatsApp" }],
  };
}

export function getCustomerDecision(item: CustomerLike): OperationalDecision {
  const hasOverdue = (item.overdueCharges ?? 0) > 0;
  const hasPending = (item.pendingCharges ?? 0) > 0;
  const hasOpenOrders = (item.openServiceOrders ?? 0) > 0;
  const isInactive = item.active === false;

  if (hasOverdue) {
    return {
      severity: "critical",
      title: "Recuperar cliente com cobrança vencida",
      description: "Existe valor vencido em aberto e o contato deve ser imediato.",
      primaryAction: { key: "open_whatsapp", label: "Enviar WhatsApp" },
      secondaryActions: [{ key: "open_finances", label: "Abrir financeiro" }],
    };
  }

  if (hasPending) {
    return {
      severity: "pending",
      title: "Acompanhar cobrança pendente",
      description: "Cliente com cobrança em aberto, precisa de follow-up operacional.",
      primaryAction: { key: "open_finances", label: "Gerar/acompanhar cobrança" },
      secondaryActions: [{ key: "open_whatsapp", label: "Enviar lembrete" }],
    };
  }

  if (!hasOpenOrders) {
    return {
      severity: "pending",
      title: "Abrir frente de execução",
      description: "Cliente sem O.S. ativa no momento, próximo passo é gerar agenda.",
      primaryAction: { key: "create_appointment", label: "Criar agendamento" },
      secondaryActions: [{ key: "create_service_order", label: "Criar O.S." }],
    };
  }

  if (isInactive) {
    return {
      severity: "overdue",
      title: "Reativar relacionamento",
      description: "Cliente inativo com histórico operacional precisa ser retomado.",
      primaryAction: { key: "open_whatsapp", label: "Reengajar no WhatsApp" },
      secondaryActions: [{ key: "open_customer", label: "Abrir cliente" }],
    };
  }

  return {
    severity: "healthy",
    title: "Fluxo em andamento",
    description: "Cliente com ciclo operacional saudável e sem bloqueios imediatos.",
    primaryAction: { key: "open_customer", label: "Ver detalhes" },
    secondaryActions: [{ key: "open_service_order", label: "Abrir execução" }],
  };
}

export function getOperationalTransitions(entity: OperationalEntity, status?: string | null) {
  const normalized = normalizeStatus(status);

  if (entity === "service_order") {
    return SERVICE_ORDER_TRANSITIONS[
      normalized as keyof typeof SERVICE_ORDER_TRANSITIONS
    ] ?? [];
  }

  if (entity === "charge") {
    return CHARGE_TRANSITIONS[normalized as keyof typeof CHARGE_TRANSITIONS] ?? [];
  }

  return APPOINTMENT_TRANSITIONS[
    normalized as keyof typeof APPOINTMENT_TRANSITIONS
  ] ?? [];
}

export function buildWhatsAppContextFromDecision(entity: OperationalEntity, item: unknown) {
  if (entity === "service_order") {
    return buildOperationalContextFromServiceOrder(item as any);
  }
  if (entity === "charge") {
    return buildOperationalContextFromCharge(item as any);
  }
  return null;
}
