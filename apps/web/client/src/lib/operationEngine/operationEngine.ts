import type { AppAction } from "@/lib/actions/types";

export type OperationPriority = "high" | "medium" | "low";

type OperationActionType =
  | "CHARGE_CUSTOMER"
  | "COMPLETE_OVERDUE_SERVICE_ORDER"
  | "CONFIRM_APPOINTMENT"
  | "WHATSAPP_FOLLOWUP"
  | "MARK_AS_SEEN";

export type OperationExecution =
  | { mode: "app_action"; action: AppAction }
  | { mode: "local"; event: "mark_seen" | "status_light_update" };

export type OperationRecommendation = {
  id: string;
  type: OperationActionType;
  label: string;
  description: string;
  priority: OperationPriority;
  score: number;
  entityType: "customer" | "appointment" | "service_order" | "charge" | "system";
  entityId: string;
  amountCents?: number;
  suggestedAt: string;
  channel?: "whatsapp" | "system";
  execution: OperationExecution;
};

export type OperationEngineInput = {
  customers: Array<{ id?: string; name?: string; phone?: string | null; lastContactAt?: string | Date | null }>;
  serviceOrders: Array<{ id?: string; customerId?: string | null; status?: string | null; delayedMinutes?: number | null; updatedAt?: string | Date | null }>;
  charges: Array<{ id?: string; customerId?: string | null; status?: string | null; amountCents?: number | null; dueDate?: string | Date | null }>;
  appointments: Array<{ id?: string; customerId?: string | null; status?: string | null; startsAt?: string | Date | null }>;
  autoExecute?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function normalize(status: unknown) {
  return String(status ?? "").trim().toUpperCase();
}

function scoreByPriority(score: number): OperationPriority {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function safeDate(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function whatsappUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildOperationalRecommendations(input: OperationEngineInput): OperationRecommendation[] {
  const now = Date.now();
  const recommendations: OperationRecommendation[] = [];

  for (const charge of input.charges) {
    const id = String(charge.id ?? "");
    const customerId = String(charge.customerId ?? "");
    if (!id || !customerId) continue;

    const dueDate = safeDate(charge.dueDate);
    const amountCents = Math.max(0, Number(charge.amountCents ?? 0));
    const isOverdue = normalize(charge.status) === "OVERDUE" || (dueDate ? dueDate.getTime() < now : false);
    if (!isOverdue) continue;

    const overdueDays = dueDate ? Math.max(1, Math.floor((now - dueDate.getTime()) / DAY_MS)) : 1;
    const valueScore = Math.min(35, Math.round(amountCents / 20000));
    const delayScore = Math.min(45, overdueDays * 8);
    const score = Math.min(100, 20 + valueScore + delayScore);

    const customer = input.customers.find(item => String(item.id ?? "") === customerId);
    const customerName = customer?.name?.trim() || "cliente";

    recommendations.push({
      id: `charge-${id}`,
      type: "CHARGE_CUSTOMER",
      label: `Cobrar ${customerName}${amountCents > 0 ? ` (${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amountCents / 100)})` : ""}`,
      description: `Cobrança vencida há ${overdueDays} dia(s).`,
      priority: scoreByPriority(score),
      score,
      entityType: "charge",
      entityId: id,
      amountCents,
      suggestedAt: new Date(now).toISOString(),
      execution: {
        mode: "app_action",
        action: {
          id: `open-charge-${id}`,
          type: "navigate",
          entityType: "charge",
          entityId: id,
          payload: { path: `/finances?chargeId=${id}` },
        },
      },
    });

    if (customer?.phone) {
      const message = `Cobrança vencida de ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amountCents / 100)}. Podemos regularizar hoje?`;
      const whatsappScore = Math.max(45, score - 8);
      recommendations.push({
        id: `whatsapp-charge-${id}`,
        type: "WHATSAPP_FOLLOWUP",
        label: `Enviar WhatsApp para ${customerName}`,
        description: "Follow-up automático com contexto financeiro.",
        priority: scoreByPriority(whatsappScore),
        score: whatsappScore,
        entityType: "customer",
        entityId: customerId,
        suggestedAt: new Date(now).toISOString(),
        channel: "whatsapp",
        execution: {
          mode: "app_action",
          action: {
            id: `whatsapp-charge-${id}`,
            type: "external",
            entityType: "customer",
            entityId: customerId,
            payload: {
              url: whatsappUrl(customer.phone, message),
              target: "_blank",
            },
          },
        },
      });
    }
  }

  for (const serviceOrder of input.serviceOrders) {
    const id = String(serviceOrder.id ?? "");
    if (!id) continue;
    const status = normalize(serviceOrder.status);
    if (status !== "OVERDUE" && status !== "AT_RISK") continue;

    const stoppedMinutes = Math.max(0, Number(serviceOrder.delayedMinutes ?? 0));
    const staleHours = Math.round(stoppedMinutes / 60);
    const score = Math.min(100, 55 + Math.min(35, Math.round(stoppedMinutes / 30)));

    recommendations.push({
      id: `service-order-${id}`,
      type: "COMPLETE_OVERDUE_SERVICE_ORDER",
      label: "Concluir O.S atrasada",
      description: staleHours > 0 ? `Ordem parada há ${staleHours}h.` : "Ordem com risco de atraso.",
      priority: scoreByPriority(score),
      score,
      entityType: "service_order",
      entityId: id,
      suggestedAt: new Date(now).toISOString(),
      execution: {
        mode: "app_action",
        action: {
          id: `open-service-order-${id}`,
          type: "navigate",
          entityType: "service_order",
          entityId: id,
          payload: { path: `/service-orders?serviceOrderId=${id}` },
        },
      },
    });
  }

  for (const appointment of input.appointments) {
    const id = String(appointment.id ?? "");
    if (!id || normalize(appointment.status) !== "SCHEDULED") continue;

    const startsAt = safeDate(appointment.startsAt);
    if (!startsAt) continue;

    const hoursToStart = Math.floor((startsAt.getTime() - now) / (60 * 60 * 1000));
    if (hoursToStart < 0 || hoursToStart > 24) continue;

    const score = Math.min(100, 50 + Math.max(0, 24 - hoursToStart));

    recommendations.push({
      id: `appointment-${id}`,
      type: "CONFIRM_APPOINTMENT",
      label: "Confirmar agendamento",
      description: `Atendimento começa em ${Math.max(0, hoursToStart)}h.`,
      priority: scoreByPriority(score),
      score,
      entityType: "appointment",
      entityId: id,
      suggestedAt: new Date(now).toISOString(),
      execution: {
        mode: "app_action",
        action: {
          id: `confirm-appointment-${id}`,
          type: "mutation",
          entityType: "appointment",
          entityId: id,
          payload: {
            mutationKey: "appointment.confirm",
            data: { appointmentId: id },
          },
        },
      },
    });
  }

  if (input.autoExecute) {
    recommendations.push({
      id: "mark-dashboard-seen",
      type: "MARK_AS_SEEN",
      label: "Marcar painel como visto",
      description: "Atualização leve executável automaticamente.",
      priority: "low",
      score: 15,
      entityType: "system",
      entityId: "dashboard",
      suggestedAt: new Date(now).toISOString(),
      execution: { mode: "local", event: "mark_seen" },
    });
  }

  return recommendations.sort((a, b) => b.score - a.score);
}
