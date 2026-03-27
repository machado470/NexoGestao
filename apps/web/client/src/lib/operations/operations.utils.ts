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
};

type WhatsAppUrlInput = {
  customerId?: string | null;
  context?: string | null;
  chargeId?: string | null;
  serviceOrderId?: string | null;
  amountCents?: number | null;
  dueDate?: string | null;
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

export function buildServiceOrdersDeepLink(id?: string | null) {
  if (!id) return "/service-orders";
  return `/service-orders?os=${id}`;
}

export function buildServiceOrdersUrl(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("os", id);
  return `${url.pathname}${url.search}`;
}

export function getServiceOrderIdFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("os");
}

export function clearServiceOrderIdFromUrl() {
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

  return {
    customerId: params.get("customerId"),
    context: normalizeWhatsAppContext(params.get("context")),
    amountCents:
      amountRaw && !Number.isNaN(Number(amountRaw)) ? Number(amountRaw) : null,
    dueDate: params.get("dueDate"),
    chargeId: params.get("chargeId"),
    serviceOrderId: params.get("serviceOrderId"),
  };
}

export function getWhatsAppContextLabel(context?: string | null) {
  const normalized = normalizeWhatsAppContext(context);

  if (normalized === "overdue_charge") return "Cobrança vencida";
  if (normalized === "charge_pending") return "Cobrança pendente";
  if (normalized === "service_order_followup")
    return "Acompanhamento da ordem de serviço";
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
      return `Cobrança pendente de ${amountLabel} com vencimento em ${dueDateLabel}.`;
    }

    if (amountLabel) {
      return `Cobrança pendente de ${amountLabel}.`;
    }

    return "Cobrança pendente vinculada ao cliente.";
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

  return `/whatsapp?${params.toString()}`;
}

export function buildWhatsAppUrlFromServiceOrder(os: any) {
  const hasCharge = Boolean(os?.financialSummary?.hasCharge);
  const status = normalizeStatus(os?.financialSummary?.chargeStatus);

  let context: WhatsAppContext = "service_order_followup";

  if (hasCharge && status === "OVERDUE") {
    context = "overdue_charge";
  } else if (hasCharge && status === "PENDING") {
    context = "charge_pending";
  }

  return buildWhatsAppConversationUrl({
    customerId: os?.customerId ? String(os.customerId) : null,
    context,
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
  });
}

export function buildWhatsAppUrlFromCharge(charge: any) {
  return buildWhatsAppConversationUrl({
    customerId: charge?.customerId ? String(charge.customerId) : null,
    context:
      normalizeStatus(charge?.status) === "OVERDUE"
        ? "overdue_charge"
        : "charge_pending",
    chargeId: charge?.id ? String(charge.id) : null,
    serviceOrderId: charge?.serviceOrderId ? String(charge.serviceOrderId) : null,
    amountCents:
      typeof charge?.amountCents === "number" ? charge.amountCents : null,
    dueDate: charge?.dueDate ? String(charge.dueDate) : null,
  });
}
