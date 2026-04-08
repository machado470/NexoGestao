export type SmartActionImpact = "revenue" | "risk" | "operation";

export type SmartAction = {
  id: string;
  label: string;
  reason: string;
  impact: SmartActionImpact;
  priority: number;
  auto?: boolean;
};

export type SmartActionWithExecution = SmartAction & {
  onExecute: () => void;
};

const IMPACT_WEIGHT: Record<SmartActionImpact, number> = {
  revenue: 0,
  risk: 1,
  operation: 2,
};

export function sortSmartActions<T extends SmartAction>(actions: T[]): T[] {
  return [...actions].sort((a, b) => {
    const impactDiff = IMPACT_WEIGHT[a.impact] - IMPACT_WEIGHT[b.impact];
    if (impactDiff !== 0) return impactDiff;

    const priorityDiff = b.priority - a.priority;
    if (priorityDiff !== 0) return priorityDiff;

    return a.label.localeCompare(b.label, "pt-BR");
  });
}

type ServiceOrderLike = {
  id: string;
  status?: string | null;
  financialSummary?: { hasCharge?: boolean | null; chargeStatus?: string | null } | null;
};

export function generateServiceOrderActions(options: {
  orders: ServiceOrderLike[];
  onGenerateCharge: (serviceOrderId: string) => void;
}): SmartActionWithExecution[] {
  const doneWithoutCharge = options.orders.find(
    (order) =>
      order.status === "DONE" &&
      (order.financialSummary?.hasCharge === false ||
        order.financialSummary?.chargeStatus === "NONE")
  );
  if (!doneWithoutCharge) return [];

  return [
    {
      id: `so-charge-${doneWithoutCharge.id}`,
      label: "Gerar cobrança da O.S. concluída",
      reason: "A ordem foi concluída sem cobrança vinculada e está bloqueando entrada de receita.",
      impact: "revenue",
      priority: 100,
      onExecute: () => options.onGenerateCharge(doneWithoutCharge.id),
    },
  ];
}

type FinanceQueueItemLike = {
  normalized: "OVERDUE" | "PENDING" | "PAID" | "NONE";
  charge: { id: string; customerPhone?: string | null; phone?: string | null };
};

export function generateFinanceActions(options: {
  billingQueue: FinanceQueueItemLike[];
  onSendWhatsApp: (chargeId: string, phone: string | null) => void;
}): SmartActionWithExecution[] {
  const overdue = options.billingQueue.find((item) => item.normalized === "OVERDUE");
  if (!overdue) return [];

  const phone = String(overdue.charge.customerPhone ?? overdue.charge.phone ?? "").trim();

  return [
    {
      id: `fin-overdue-${overdue.charge.id}`,
      label: "Enviar WhatsApp de cobrança vencida",
      reason: "Cobrança vencida tem impacto direto no caixa e precisa de follow-up imediato.",
      impact: "revenue",
      priority: 95,
      auto: true,
      onExecute: () => options.onSendWhatsApp(overdue.charge.id, phone || null),
    },
  ];
}

export function generateCustomerActions(options: {
  customerId?: string | null;
  appointmentsCount: number;
  onSuggestAppointment: () => void;
}): SmartActionWithExecution[] {
  if (!options.customerId || options.appointmentsCount > 0) return [];

  return [
    {
      id: `cust-appointment-${options.customerId}`,
      label: "Sugerir agendamento para cliente sem agenda",
      reason: "Cliente sem agendamento perde tração operacional e reduz chance de conversão.",
      impact: "operation",
      priority: 55,
      onExecute: options.onSuggestAppointment,
    },
  ];
}

type AppointmentLike = {
  id: string;
  status?: string | null;
};

export function generateAppointmentActions(options: {
  appointments: AppointmentLike[];
  onConfirmAppointment: (appointmentId: string) => void;
}): SmartActionWithExecution[] {
  const unconfirmed = options.appointments.find((appointment) => appointment.status === "SCHEDULED");
  if (!unconfirmed) return [];

  return [
    {
      id: `appt-confirm-${unconfirmed.id}`,
      label: "Enviar confirmação de agendamento",
      reason: "Agendamento não confirmado aumenta risco de no-show e quebra da operação diária.",
      impact: "risk",
      priority: 80,
      auto: true,
      onExecute: () => options.onConfirmAppointment(unconfirmed.id),
    },
  ];
}
