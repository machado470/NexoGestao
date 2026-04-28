import { normalizeList } from "@/lib/utils/normalizeList";

export type WhatsAppContext =
  | "overdue_charge"
  | "charge_pending"
  | "service_order_followup"
  | "general";

export type ParsedWhatsAppRoute = {
  customerId: string | null;
  context: WhatsAppContext;
  amountCents: number | null;
  dueDate: string | null;
  chargeId: string | null;
  serviceOrderId: string | null;
  returnTo: string | null;
};

export type OperationalContext = {
  customerId: string | null;
  chargeId: string | null;
  serviceOrderId: string | null;
  amountCents: number | null;
  dueDate: string | null;
  context: WhatsAppContext;
};

export type TimelineEventNavigationTarget =
  | "customer"
  | "appointment"
  | "serviceOrder"
  | "charge"
  | "payment"
  | "timeline"
  | "unknown";

export type TimelineEventLink = {
  label: string;
  href: string;
  target: TimelineEventNavigationTarget;
};

type WhatsAppUrlInput = {
  customerId?: string | null;
  context?: string | null;
  chargeId?: string | null;
  serviceOrderId?: string | null;
  amountCents?: number | null;
  dueDate?: string | null;
  returnTo?: string | null;
};

function sanitizeReturnPath(path?: string | null) {
  if (!path) return null;
  const normalized = String(path).trim();
  if (!normalized.startsWith("/")) return null;
  if (normalized.startsWith("//")) return null;
  return normalized;
}

type TimelineEventLike = {
  id?: string | null;
  action?: string | null;
  type?: string | null;
  eventType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  customerId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export function normalizeOrders<T = any>(data: unknown): T[] {
  return normalizeList<T>(data);
}

export function normalizeCharges<T = any>(data: unknown): T[] {
  return normalizeList<T>(data);
}

export function normalizeAppointments<T = any>(data: unknown): T[] {
  return normalizeList<T>(data);
}

export function normalizeStatus(value?: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

export function formatCurrency(valueCents?: number | null) {
  if (typeof valueCents !== "number") return "—";

  return (valueCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR");
}

export function buildFinanceChargeUrl(chargeId?: string | null) {
  if (!chargeId) return "/finances";
  return `/finances?chargeId=${chargeId}`;
}

export function buildFinancePaymentUrl(paymentId?: string | null) {
  if (!paymentId) return "/finances";
  return `/finances?paymentId=${paymentId}`;
}

export function buildCustomersDeepLink(customerId?: string | null) {
  if (!customerId) return "/customers";
  return `/customers?customerId=${customerId}`;
}

export function buildAppointmentsDeepLink(appointmentId?: string | null) {
  if (!appointmentId) return "/appointments";
  return `/appointments?appointmentId=${appointmentId}`;
}

export function buildTimelineDeepLink(customerId?: string | null) {
  if (!customerId) return "/timeline";
  return `/timeline?customerId=${customerId}`;
}

export function buildServiceOrdersDeepLink(
  id?: string | null,
  base?: "operations" | "service-orders"
) {
  const root = base === "operations" ? "/operations" : "/service-orders";

  if (!id) return root;

  return `${root}?os=${id}`;
}

export function buildServiceOrdersUrl(
  id: string,
  base?: "operations" | "service-orders"
) {
  const pathname =
    typeof window !== "undefined"
      ? window.location.pathname
      : base === "operations"
        ? "/operations"
        : "/service-orders";

  return `${pathname}?os=${id}`;
}

export function getServiceOrderIdFromUrl(location?: string) {
  if (location) {
    const query = location.split("?")[1] || "";
    const params = new URLSearchParams(query);
    return params.get("os");
  }

  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  return url.searchParams.get("os");
}

export function clearServiceOrderIdFromUrl(location?: string) {
  if (location) {
    const [pathname] = location.split("?");
    return pathname || "/service-orders";
  }

  if (typeof window === "undefined") return "/service-orders";

  const url = new URL(window.location.href);
  url.searchParams.delete("os");
  return `${url.pathname}${url.search}`;
}

export function normalizeWhatsAppContext(
  value?: string | null
): WhatsAppContext {
  if (value === "overdue_charge") return "overdue_charge";
  if (value === "charge_pending") return "charge_pending";
  if (value === "service_order_followup") return "service_order_followup";
  return "general";
}

export function parseWhatsAppRoute(location: string): ParsedWhatsAppRoute {
  const params = new URLSearchParams(location.split("?")[1] || "");
  const amountRaw = params.get("amountCents");
  const returnTo = sanitizeReturnPath(params.get("returnTo"));

  return {
    customerId: params.get("customerId"),
    context: normalizeWhatsAppContext(params.get("context")),
    amountCents:
      amountRaw && !Number.isNaN(Number(amountRaw)) ? Number(amountRaw) : null,
    dueDate: params.get("dueDate"),
    chargeId: params.get("chargeId"),
    serviceOrderId: params.get("serviceOrderId"),
    returnTo,
  };
}

export function getWhatsAppContextLabel(context?: string | null) {
  const normalized = normalizeWhatsAppContext(context);

  if (normalized === "overdue_charge") return "Cobrança vencida";
  if (normalized === "charge_pending") return "Dinheiro parado (cobrança pendente)";
  if (normalized === "service_order_followup") {
    return "Acompanhamento da ordem de serviço";
  }

  return "Contato geral";
}

export function getWhatsAppContextDescription(route: ParsedWhatsAppRoute) {
  const amountLabel =
    route.amountCents !== null ? formatCurrency(route.amountCents) : null;
  const dueDateLabel = route.dueDate ? formatDate(route.dueDate) : null;

  if (route.context === "overdue_charge") {
    if (amountLabel && dueDateLabel) {
      return `Cobrança vencida de ${amountLabel} com vencimento em ${dueDateLabel}.`;
    }

    if (amountLabel) {
      return `Cobrança vencida de ${amountLabel}.`;
    }

    return "Cobrança vencida vinculada ao cliente.";
  }

  if (route.context === "charge_pending") {
    if (amountLabel && dueDateLabel) {
      return `Você tem ${amountLabel} parado, com vencimento em ${dueDateLabel}.`;
    }

    if (amountLabel) {
      return `Você tem ${amountLabel} parado aguardando recebimento.`;
    }

    return "Existe dinheiro parado nesta conta aguardando ação.";
  }

  if (route.context === "service_order_followup") {
    return "Contato operacional relacionado à ordem de serviço.";
  }

  return "Conversa manual iniciada pelo operador.";
}

export function getWhatsAppPrefilledMessage(
  customer: any,
  route: ParsedWhatsAppRoute
) {
  const firstName = customer?.name?.split(" ")[0] || "cliente";
  const amount =
    route.amountCents !== null ? formatCurrency(route.amountCents) : null;
  const dueDate = route.dueDate ? formatDate(route.dueDate) : null;

  if (route.context === "overdue_charge") {
    if (amount && dueDate) {
      return `Olá ${firstName}, tudo bem? Identificamos uma cobrança vencida de ${amount}, com vencimento em ${dueDate}. Posso te enviar o link de pagamento para regularizar?`;
    }

    if (amount) {
      return `Olá ${firstName}, tudo bem? Identificamos uma cobrança vencida de ${amount}. Posso te enviar o link de pagamento para regularizar?`;
    }

    return `Olá ${firstName}, tudo bem? Identificamos uma cobrança vencida em aberto. Posso te enviar o link de pagamento para regularizar?`;
  }

  if (route.context === "charge_pending") {
    if (amount && dueDate) {
      return `Olá ${firstName}, tudo bem? Passando para lembrar da cobrança de ${amount}, com vencimento em ${dueDate}. Posso te enviar o link de pagamento?`;
    }

    if (amount) {
      return `Olá ${firstName}, tudo bem? Passando para lembrar da cobrança de ${amount}. Posso te enviar o link de pagamento?`;
    }

    return `Olá ${firstName}, tudo bem? Passando para lembrar de uma cobrança em aberto. Posso te enviar o link de pagamento?`;
  }

  if (route.context === "service_order_followup") {
    return `Olá ${firstName}, tudo bem? Estou entrando em contato sobre sua ordem de serviço para te passar um retorno rápido.`;
  }

  return `Olá ${firstName}, tudo bem?`;
}

export function buildWhatsAppConversationUrl(input: WhatsAppUrlInput) {
  if (!input.customerId) return null;

  const params = new URLSearchParams();
  params.set("customerId", String(input.customerId));

  if (input.context) {
    params.set("context", String(input.context));
  }

  if (input.chargeId) {
    params.set("chargeId", String(input.chargeId));
  }

  if (input.serviceOrderId) {
    params.set("serviceOrderId", String(input.serviceOrderId));
  }

  if (
    typeof input.amountCents === "number" &&
    !Number.isNaN(input.amountCents)
  ) {
    params.set("amountCents", String(input.amountCents));
  }

  if (input.dueDate) {
    params.set("dueDate", String(input.dueDate));
  }

  const returnTo = sanitizeReturnPath(input.returnTo);
  if (returnTo) {
    params.set("returnTo", returnTo);
  }

  return `/whatsapp?${params.toString()}`;
}

export function buildOperationalContextFromServiceOrder(
  os: any
): OperationalContext {
  const hasCharge = Boolean(os?.financialSummary?.hasCharge);
  const status = normalizeStatus(os?.financialSummary?.chargeStatus);

  let context: WhatsAppContext = "service_order_followup";

  if (hasCharge && status === "OVERDUE") {
    context = "overdue_charge";
  } else if (hasCharge && status === "PENDING") {
    context = "charge_pending";
  }

  return {
    customerId: os?.customerId ? String(os.customerId) : null,
    chargeId: os?.financialSummary?.chargeId
      ? String(os.financialSummary.chargeId)
      : null,
    serviceOrderId: os?.id ? String(os.id) : null,
    amountCents:
      typeof os?.financialSummary?.chargeAmountCents === "number"
        ? os.financialSummary.chargeAmountCents
        : null,
    dueDate: os?.financialSummary?.chargeDueDate
      ? String(os.financialSummary.chargeDueDate)
      : null,
    context,
  };
}

export function buildOperationalContextFromCharge(
  charge: any
): OperationalContext {
  return {
    customerId: charge?.customerId ? String(charge.customerId) : null,
    chargeId: charge?.id ? String(charge.id) : null,
    serviceOrderId: charge?.serviceOrderId
      ? String(charge.serviceOrderId)
      : null,
    amountCents:
      typeof charge?.amountCents === "number" ? charge.amountCents : null,
    dueDate: charge?.dueDate ? String(charge.dueDate) : null,
    context:
      normalizeStatus(charge?.status) === "OVERDUE"
        ? "overdue_charge"
        : "charge_pending",
  };
}

export function buildWhatsAppUrlFromContext(ctx: OperationalContext) {
  return buildWhatsAppConversationUrl({
    customerId: ctx.customerId,
    context: ctx.context,
    chargeId: ctx.chargeId,
    serviceOrderId: ctx.serviceOrderId,
    amountCents: ctx.amountCents,
    dueDate: ctx.dueDate,
  });
}

export function buildWhatsAppUrlFromServiceOrder(os: any) {
  return buildWhatsAppUrlFromContext(
    buildOperationalContextFromServiceOrder(os)
  );
}

export function buildWhatsAppUrlFromCharge(charge: any) {
  return buildWhatsAppUrlFromContext(buildOperationalContextFromCharge(charge));
}

export function getTimelineEventKey(event: TimelineEventLike) {
  return normalizeStatus(event.eventType ?? event.action ?? event.type);
}

export function getTimelineEventLabel(event: TimelineEventLike) {
  const key = getTimelineEventKey(event);

  const labels: Record<string, string> = {
    CUSTOMER_CREATED: "Cliente criado",
    CUSTOMER_UPDATED: "Cliente atualizado",
    APPOINTMENT_CREATED: "Agendamento criado",
    APPOINTMENT_UPDATED: "Agendamento atualizado",
    APPOINTMENT_CONFIRMED: "Agendamento confirmado",
    APPOINTMENT_CANCELED: "Agendamento cancelado",
    APPOINTMENT_CANCELLED: "Agendamento cancelado",
    SERVICE_ORDER_CREATED: "O.S. criada",
    SERVICE_ORDER_UPDATED: "O.S. atualizada",
    SERVICE_ORDER_ASSIGNED: "O.S. atribuída",
    SERVICE_ORDER_STARTED: "Execução iniciada",
    SERVICE_ORDER_DONE: "Execução concluída",
    SERVICE_ORDER_COMPLETED: "Execução concluída",
    SERVICE_ORDER_CANCELED: "O.S. cancelada",
    SERVICE_ORDER_CANCELLED: "O.S. cancelada",
    CHARGE_CREATED: "Cobrança criada",
    CHARGE_UPDATED: "Cobrança atualizada",
    CHARGE_CANCELED: "Cobrança cancelada",
    CHARGE_CANCELLED: "Cobrança cancelada",
    CHARGE_DELETED: "Cobrança excluída",
    CHARGE_PAID: "Cobrança paga",
    CHARGE_OVERDUE: "Cobrança vencida",
    PAYMENT_RECEIVED: "Pagamento recebido",
    PAYMENT_CONFIRMED: "Pagamento confirmado",
    RISK_UPDATED: "Risco atualizado",
    GOVERNANCE_RUN_STARTED: "Governança iniciada",
    GOVERNANCE_RUN_COMPLETED: "Governança concluída",
    OPERATIONAL_STATE_CHANGED: "Estado operacional alterado",
    MESSAGE_SENT: "Mensagem enviada",
    MESSAGE_FAILED: "Falha no envio da mensagem",
    MESSAGE_RETRY_REQUESTED: "Retry de mensagem solicitado",
    PAYMENT_LINK_SENT: "Link de pagamento enviado",
    APPOINTMENT_REMINDER_SENT: "Lembrete de agendamento enviado",
    SERVICE_UPDATE_SENT: "Atualização da O.S. enviada",
  };

  // TODO(whatsapp-events): remover fallback quando backend padronizar todos os eventos de WhatsApp/Comunicação.
  const fallback = key.split("_").join(" ").trim();
  return labels[key] ?? (fallback || "Evento");
}

export function getTimelineEventDescription(event: TimelineEventLike) {
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;
  const amountLabel =
    typeof metadata.amountCents === "number"
      ? formatCurrency(metadata.amountCents)
      : null;
  const dueDateLabel =
    typeof metadata.dueDate === "string" ? formatDate(metadata.dueDate) : null;
  const method =
    typeof metadata.method === "string" && metadata.method.trim()
      ? metadata.method
      : null;

  const key = getTimelineEventKey(event);

  if (key === "PAYMENT_RECEIVED" || key === "PAYMENT_CONFIRMED") {
    if (amountLabel && method) {
      return `Pagamento recebido no valor de ${amountLabel} via ${method}.`;
    }

    if (amountLabel) {
      return `Pagamento recebido no valor de ${amountLabel}.`;
    }

    return "Pagamento registrado na operação.";
  }

  if (key === "CHARGE_CREATED") {
    if (amountLabel && dueDateLabel) {
      return `Cobrança criada no valor de ${amountLabel} com vencimento em ${dueDateLabel}.`;
    }

    if (amountLabel) {
      return `Cobrança criada no valor de ${amountLabel}.`;
    }

    return "Cobrança gerada para a operação.";
  }

  if (key === "CHARGE_OVERDUE") {
    if (amountLabel && dueDateLabel) {
      return `Cobrança vencida de ${amountLabel} com vencimento em ${dueDateLabel}.`;
    }

    if (amountLabel) {
      return `Cobrança vencida de ${amountLabel}.`;
    }

    return "Cobrança marcada como vencida.";
  }

  if (key === "SERVICE_ORDER_COMPLETED" || key === "SERVICE_ORDER_DONE") {
    return "Execução finalizada e pronta para revisão financeira.";
  }

  if (key === "APPOINTMENT_CREATED") {
    return "Agendamento criado e pronto para confirmação.";
  }

  if (key === "APPOINTMENT_CONFIRMED") {
    return "Agendamento confirmado e pronto para execução.";
  }

  if (key === "RISK_UPDATED") {
    return "Estado de risco recalculado pelo sistema.";
  }

  if (key === "GOVERNANCE_RUN_STARTED" || key === "GOVERNANCE_RUN_COMPLETED") {
    return "Evento registrado pelo fluxo de governança operacional.";
  }

  const description =
    typeof event.description === "string" ? event.description.trim() : "";

  if (description) {
    return description;
  }

  return "Evento operacional registrado.";
}

export function getTimelineEventSummary(event: TimelineEventLike) {
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;

  const appointmentId = getTimelineMetadataId(metadata, "appointmentId");
  const serviceOrderId = getTimelineMetadataId(metadata, "serviceOrderId");
  const chargeId = getTimelineMetadataId(metadata, "chargeId");
  const paymentId = getTimelineMetadataId(metadata, "paymentId");
  const amountCents = metadata.amountCents;
  const status =
    typeof metadata.status === "string" ? normalizeStatus(metadata.status) : "";
  const dueDate =
    typeof metadata.dueDate === "string" ? metadata.dueDate.trim() : "";
  const previousState =
    typeof metadata.previousState === "string"
      ? metadata.previousState.trim()
      : "";
  const nextState =
    typeof metadata.nextState === "string" ? metadata.nextState.trim() : "";
  const method =
    typeof metadata.method === "string" ? metadata.method.trim() : "";

  const pieces: string[] = [];

  if (appointmentId) {
    pieces.push(`Agendamento #${appointmentId.slice(0, 8)}`);
  }

  if (serviceOrderId) {
    pieces.push(`O.S. #${serviceOrderId.slice(0, 8)}`);
  }

  if (chargeId) {
    pieces.push(`Cobrança #${chargeId.slice(0, 8)}`);
  }

  if (paymentId) {
    pieces.push(`Pagamento #${paymentId.slice(0, 8)}`);
  }

  if (typeof amountCents === "number" && Number.isFinite(amountCents)) {
    pieces.push(formatCurrency(amountCents));
  }

  if (method) {
    pieces.push(`Via ${method}`);
  }

  if (status) {
    const statusLabels: Record<string, string> = {
      PENDING: "Pendente",
      PAID: "Pago",
      OVERDUE: "Vencida",
      CANCELED: "Cancelada",
      CANCELLED: "Cancelada",
      OPEN: "Aberta",
      ASSIGNED: "Atribuída",
      IN_PROGRESS: "Em andamento",
      DONE: "Concluída",
      WARNING: "Atenção",
      RESTRICTED: "Restrito",
      SUSPENDED: "Suspenso",
      NORMAL: "Normal",
    };

    pieces.push(`Status ${statusLabels[status] ?? status}`);
  }

  if (previousState && nextState) {
    pieces.push(`Estado ${previousState} → ${nextState}`);
  }

  if (dueDate) {
    pieces.push(`Venc. ${formatDate(dueDate)}`);
  }

  return pieces.join(" • ");
}

export function getTimelineEventPrimaryLink(
  event: TimelineEventLike
): TimelineEventLink | null {
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;

  const customerId =
    getTimelineMetadataId(metadata, "customerId") ??
    normalizeNullableId(event.customerId);
  const appointmentId =
    getTimelineMetadataId(metadata, "appointmentId") ??
    (normalizeStatus(event.entityType) === "APPOINTMENT"
      ? normalizeNullableId(event.entityId)
      : null);
  const serviceOrderId =
    getTimelineMetadataId(metadata, "serviceOrderId") ??
    (normalizeStatus(event.entityType) === "SERVICE_ORDER"
      ? normalizeNullableId(event.entityId)
      : null);
  const chargeId =
    getTimelineMetadataId(metadata, "chargeId") ??
    (normalizeStatus(event.entityType) === "CHARGE"
      ? normalizeNullableId(event.entityId)
      : null);
  const paymentId =
    getTimelineMetadataId(metadata, "paymentId") ??
    (normalizeStatus(event.entityType) === "PAYMENT"
      ? normalizeNullableId(event.entityId)
      : null);

  if (serviceOrderId) {
    return {
      label: "Abrir O.S.",
      href: buildServiceOrdersDeepLink(serviceOrderId, "operations"),
      target: "serviceOrder",
    };
  }

  if (chargeId) {
    return {
      label: "Abrir cobrança",
      href: buildFinanceChargeUrl(chargeId),
      target: "charge",
    };
  }

  if (paymentId) {
    return {
      label: "Abrir pagamento",
      href: buildFinancePaymentUrl(paymentId),
      target: "payment",
    };
  }

  if (appointmentId) {
    return {
      label: "Abrir agendamento",
      href: buildAppointmentsDeepLink(appointmentId),
      target: "appointment",
    };
  }

  if (customerId) {
    return {
      label: "Abrir cliente",
      href: buildCustomersDeepLink(customerId),
      target: "customer",
    };
  }

  return null;
}

export function getTimelineEventSecondaryLinks(
  event: TimelineEventLike
): TimelineEventLink[] {
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;

  const customerId =
    getTimelineMetadataId(metadata, "customerId") ??
    normalizeNullableId(event.customerId);
  const appointmentId =
    getTimelineMetadataId(metadata, "appointmentId") ??
    (normalizeStatus(event.entityType) === "APPOINTMENT"
      ? normalizeNullableId(event.entityId)
      : null);
  const serviceOrderId =
    getTimelineMetadataId(metadata, "serviceOrderId") ??
    (normalizeStatus(event.entityType) === "SERVICE_ORDER"
      ? normalizeNullableId(event.entityId)
      : null);
  const chargeId =
    getTimelineMetadataId(metadata, "chargeId") ??
    (normalizeStatus(event.entityType) === "CHARGE"
      ? normalizeNullableId(event.entityId)
      : null);

  const links: TimelineEventLink[] = [];

  if (customerId) {
    links.push({
      label: "Cliente",
      href: buildCustomersDeepLink(customerId),
      target: "customer",
    });
  }

  if (appointmentId) {
    links.push({
      label: "Agendamento",
      href: buildAppointmentsDeepLink(appointmentId),
      target: "appointment",
    });
  }

  if (serviceOrderId) {
    links.push({
      label: "O.S.",
      href: buildServiceOrdersDeepLink(serviceOrderId, "operations"),
      target: "serviceOrder",
    });
  }

  if (chargeId) {
    links.push({
      label: "Cobrança",
      href: buildFinanceChargeUrl(chargeId),
      target: "charge",
    });
  }

  if (customerId) {
    links.push({
      label: "Timeline",
      href: buildTimelineDeepLink(customerId),
      target: "timeline",
    });
  }

  return dedupeTimelineLinks(links);
}

export function getTimelineEventNextAction(event: TimelineEventLike) {
  const key = getTimelineEventKey(event);

  if (key.includes("CHARGE_OVERDUE")) {
    return {
      label: "Cobrar cliente",
      tone:
        "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
    };
  }

  if (
    key.includes("SERVICE_ORDER_DONE") ||
    key.includes("SERVICE_ORDER_COMPLETED")
  ) {
    return {
      label: "Verificar cobrança",
      tone:
        "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
    };
  }

  if (key.includes("APPOINTMENT_CREATED")) {
    return {
      label: "Confirmar agendamento",
      tone:
        "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-200",
    };
  }

  if (key.includes("APPOINTMENT_CONFIRMED")) {
    return {
      label: "Abrir execução",
      tone:
        "border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
    };
  }

  if (key.includes("RISK") || key.includes("GOVERNANCE")) {
    return {
      label: "Revisar impacto operacional",
      tone:
        "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-300",
    };
  }

  return {
    label: "Sem ação crítica imediata",
    tone:
      "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
  };
}

export function getTimelineMetadataId(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeNullableId(value?: string | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function dedupeTimelineLinks(links: TimelineEventLink[]) {
  const seen = new Set<string>();

  return links.filter((link) => {
    const key = `${link.target}:${link.href}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}
