import type { Decision } from "./decision.types";

type ResolverContext = {
  navigate: (href: string) => void;
};

type FinanceData = { charges: any[] };
type AppointmentData = { appointments: any[] };
type ServiceOrderData = { serviceOrders: any[] };
type WhatsappData = { customers: any[]; messages: any[] };
type GovernanceData = { summary?: Record<string, any> | null };

const DAY_MS = 24 * 60 * 60 * 1000;

function asDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getFinanceDecisions(data: FinanceData, ctx: ResolverContext): Decision[] {
  const now = Date.now();
  return data.charges.flatMap((charge) => {
    const id = String(charge?.id ?? "");
    const customerId = String(charge?.customerId ?? "");
    if (!id || !customerId) return [];

    const status = String(charge?.status ?? "").toUpperCase();
    const dueDate = asDate(charge?.dueDate);
    const isOverdue = status === "OVERDUE" || Boolean(dueDate && dueDate.getTime() < now && status !== "PAID");
    if (!isOverdue) return [];

    return [{
      id: `finance-overdue-${id}`,
      title: "Cobrança vencida",
      description: "Cobrança vencida impactando caixa. Execute contato de regularização agora.",
      severity: "critical",
      source: "finance",
      entityId: id,
      action: {
        label: "Cobrar no WhatsApp",
        execute: () => ctx.navigate(`/whatsapp?customerId=${customerId}&chargeId=${id}`),
      },
    } satisfies Decision];
  });
}

export function getAppointmentDecisions(data: AppointmentData, ctx: ResolverContext): Decision[] {
  const slots = new Map<string, number>();
  for (const appointment of data.appointments) {
    const startsAt = asDate(appointment?.startsAt);
    const key = startsAt?.toISOString().slice(0, 16) ?? "";
    if (!key) continue;
    slots.set(key, (slots.get(key) ?? 0) + 1);
  }

  return data.appointments.flatMap((appointment) => {
    const id = String(appointment?.id ?? "");
    const customerId = String(appointment?.customerId ?? "");
    if (!id || !customerId) return [];

    const startsAt = asDate(appointment?.startsAt);
    const slot = startsAt?.toISOString().slice(0, 16) ?? "";
    const hasConflict = Boolean(slot && (slots.get(slot) ?? 0) > 1);
    if (!hasConflict) return [];

    return [{
      id: `appointment-conflict-${id}`,
      title: "Conflito de agendamento",
      description: "Há sobreposição de horário. Reagende para evitar quebra de execução.",
      severity: "high",
      source: "appointment",
      entityId: id,
      action: {
        label: "Reagendar",
        execute: () => ctx.navigate(`/appointments?customerId=${customerId}&appointmentId=${id}`),
      },
    } satisfies Decision];
  });
}

export function getServiceOrderDecisions(data: ServiceOrderData, ctx: ResolverContext): Decision[] {
  return data.serviceOrders.flatMap((serviceOrder) => {
    const id = String(serviceOrder?.id ?? "");
    if (!id) return [];

    const customerId = String(serviceOrder?.customerId ?? "");
    const status = String(serviceOrder?.status ?? "").toUpperCase();
    const isBlocked = ["OPEN", "ASSIGNED", "AT_RISK", "OVERDUE"].includes(status);
    if (!isBlocked) return [];

    return [{
      id: `service-order-stalled-${id}`,
      title: "O.S. parada",
      description: "Ordem de serviço sem progresso. Avance a execução para evitar risco de SLA.",
      severity: "high",
      source: "service-order",
      entityId: id,
      action: {
        label: "Abrir O.S.",
        execute: () => ctx.navigate(`/service-orders?serviceOrderId=${id}${customerId ? `&customerId=${customerId}` : ""}`),
      },
    } satisfies Decision];
  });
}

export function getWhatsappDecisions(data: WhatsappData, ctx: ResolverContext): Decision[] {
  const now = Date.now();
  return data.customers.flatMap((customer) => {
    const customerId = String(customer?.id ?? "");
    if (!customerId) return [];

    const lastContact = asDate(customer?.lastContactAt);
    const hasNoRecentContact = !lastContact || now - lastContact.getTime() > 7 * DAY_MS;
    if (!hasNoRecentContact) return [];

    return [{
      id: `whatsapp-no-reply-${customerId}`,
      title: "Cliente sem retorno",
      description: "Sem resposta recente. Execute follow-up para proteger retenção.",
      severity: "medium",
      source: "whatsapp",
      entityId: customerId,
      action: {
        label: "Enviar follow-up",
        execute: () => ctx.navigate(`/whatsapp?customerId=${customerId}`),
      },
    } satisfies Decision];
  });
}

export function getGovernanceDecisions(data: GovernanceData, ctx: ResolverContext): Decision[] {
  const riskScore = Number(data.summary?.riskScore ?? data.summary?.overallRisk ?? 0);
  if (!Number.isFinite(riskScore) || riskScore < 70) return [];

  return [{
    id: "governance-risk-review",
    title: "Risco operacional elevado",
    description: "Score de risco acima do limite. Execute revisão de contenção imediatamente.",
    severity: "high",
    source: "governance",
    action: {
      label: "Abrir governança",
      execute: () => ctx.navigate("/governance"),
    },
  }];
}
