import { normalizeList } from "@/lib/utils/normalizeList";

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

type WhatsAppUrlInput = {
  customerId?: string | null;
  context?: string | null;
  chargeId?: string | null;
  serviceOrderId?: string | null;
  amountCents?: number | null;
  dueDate?: string | null;
};

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

  if (typeof input.amountCents === "number" && !Number.isNaN(input.amountCents)) {
    params.set("amountCents", String(input.amountCents));
  }

  if (input.dueDate) {
    params.set("dueDate", String(input.dueDate));
  }

  return `/whatsapp?${params.toString()}`;
}

export function buildWhatsAppUrlFromServiceOrder(os: any) {
  return buildWhatsAppConversationUrl({
    customerId: os?.customerId ? String(os.customerId) : null,
    context: os?.financialSummary?.hasCharge
      ? "overdue_charge"
      : "service_order_followup",
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
    context: "overdue_charge",
    chargeId: charge?.id ? String(charge.id) : null,
    serviceOrderId: charge?.serviceOrderId ? String(charge.serviceOrderId) : null,
    amountCents:
      typeof charge?.amountCents === "number" ? charge.amountCents : null,
    dueDate: charge?.dueDate ? String(charge.dueDate) : null,
  });
}
