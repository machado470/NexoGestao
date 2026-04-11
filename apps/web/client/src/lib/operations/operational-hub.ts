import { normalizeStatus } from "@/lib/operations/operations.utils";

export type OperationalStateLevel = "NORMAL" | "WARNING" | "RESTRICTED" | "SUSPENDED";

export type OperationalNextAction = {
  id: string;
  title: string;
  description: string;
  severity: "healthy" | "pending" | "overdue" | "critical";
  entityType:
    | "customer"
    | "appointment"
    | "service_order"
    | "charge"
    | "whatsapp"
    | "governance";
  entityId?: string;
  actionType:
    | "open"
    | "charge"
    | "followup"
    | "confirm"
    | "resolve"
    | "review";
  href: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export type OperationalStateSummary = {
  level: OperationalStateLevel;
  label: string;
  summary: string;
  impact: string;
  recommendedAction?: string;
};

function bySeverityScore(level: OperationalNextAction["severity"]) {
  if (level === "critical") return 0;
  if (level === "overdue") return 1;
  if (level === "pending") return 2;
  return 3;
}

export function getOperationalStateSummary(input: {
  overdueCharges: number;
  doneWithoutCharge: number;
  overdueAppointments: number;
  failedWhatsAppMessages: number;
  governanceState?: string | null;
}): OperationalStateSummary {
  const governance = String(input.governanceState ?? "").toUpperCase();
  if (governance === "SUSPENDED") {
    return {
      level: "SUSPENDED",
      label: "Suspenso",
      summary: "Operação bloqueada por política crítica.",
      impact: "Execução e faturamento com bloqueios ativos.",
      recommendedAction: "Resolver pendências de governança e faturamento imediatamente.",
    };
  }

  const criticalSignals =
    input.overdueCharges + input.doneWithoutCharge + input.failedWhatsAppMessages;
  if (governance === "RESTRICTED" || criticalSignals >= 5) {
    return {
      level: "RESTRICTED",
      label: "Restrito",
      summary: "Fluxo operacional degradado e suscetível a perda de receita.",
      impact: "Atrasos em cobrança e atendimento comprometem o caixa.",
      recommendedAction: "Priorizar recuperação de cobrança e destravar ordens críticas.",
    };
  }

  if (
    governance === "WARNING" ||
    input.overdueCharges > 0 ||
    input.doneWithoutCharge > 0 ||
    input.overdueAppointments > 0
  ) {
    return {
      level: "WARNING",
      label: "Atenção",
      summary: "Há sinais de risco operacional no ciclo do serviço.",
      impact: "Se não agir hoje, há tendência de acúmulo de gargalos.",
      recommendedAction: "Executar próximas ações prioritárias para estabilizar a operação.",
    };
  }

  return {
    level: "NORMAL",
    label: "Normal",
    summary: "Operação estável com fluxo de execução e caixa sob controle.",
    impact: "Sem bloqueios imediatos no ciclo cliente → pagamento.",
    recommendedAction: "Manter monitoramento e ritmo de follow-up preventivo.",
  };
}

export function buildNextActions(params: {
  customers: Array<{ id?: string; name?: string; active?: boolean | null }>;
  appointments: Array<{ id?: string; status?: string | null; startsAt?: string | Date | null; customerId?: string | null }>;
  serviceOrders: Array<{ id?: string; status?: string | null; customerId?: string | null; financialSummary?: { hasCharge?: boolean | null } | null }>;
  charges: Array<{ id?: string; status?: string | null; customerId?: string | null; dueDate?: string | Date | null; amountCents?: number | null }>;
  whatsappFailures?: Array<{ id?: string; customerId?: string | null; reason?: string | null }>;
}): OperationalNextAction[] {
  const list: OperationalNextAction[] = [];

  const now = Date.now();

  const missingAppointment = params.customers.find(customer => {
    const customerId = String(customer.id ?? "");
    if (!customerId) return false;
    return !params.appointments.some(item => String(item.customerId ?? "") === customerId);
  });

  if (missingAppointment?.id) {
    list.push({
      id: `customer-no-appointment-${missingAppointment.id}`,
      title: `Cliente sem agendamento: ${missingAppointment.name ?? "cliente"}`,
      description: "Sem agenda ativa, o relacionamento tende a esfriar e reduzir conversão.",
      severity: "pending",
      entityType: "customer",
      entityId: String(missingAppointment.id),
      actionType: "confirm",
      href: `/appointments?customerId=${missingAppointment.id}`,
    });
  }

  const appointmentToConfirm = params.appointments.find(item => {
    const status = normalizeStatus(item.status);
    if (status !== "SCHEDULED") return false;
    const startsAt = item.startsAt ? new Date(item.startsAt).getTime() : NaN;
    return Number.isFinite(startsAt) && startsAt > now && startsAt - now <= 24 * 60 * 60 * 1000;
  });

  if (appointmentToConfirm?.id) {
    list.push({
      id: `appointment-confirm-${appointmentToConfirm.id}`,
      title: "Confirmar agendamento próximo",
      description: "Agendamento nas próximas 24h ainda sem confirmação.",
      severity: "pending",
      entityType: "appointment",
      entityId: String(appointmentToConfirm.id),
      actionType: "confirm",
      href: `/appointments?appointmentId=${appointmentToConfirm.id}`,
    });
  }

  const doneWithoutCharge = params.serviceOrders.find(item => {
    const status = normalizeStatus(item.status);
    return status === "DONE" && !item.financialSummary?.hasCharge;
  });

  if (doneWithoutCharge?.id) {
    list.push({
      id: `so-no-charge-${doneWithoutCharge.id}`,
      title: "O.S. concluída sem cobrança",
      description: "Serviço finalizado sem conversão financeira.",
      severity: "critical",
      entityType: "service_order",
      entityId: String(doneWithoutCharge.id),
      actionType: "charge",
      href: `/finances?serviceOrderId=${doneWithoutCharge.id}`,
    });
  }

  const overdueCharge = params.charges.find(item => normalizeStatus(item.status) === "OVERDUE");
  if (overdueCharge?.id) {
    list.push({
      id: `charge-overdue-${overdueCharge.id}`,
      title: "Cobrança vencida sem follow-up",
      description: "Recuperação pendente com impacto direto no caixa diário.",
      severity: "overdue",
      entityType: "charge",
      entityId: String(overdueCharge.id),
      actionType: "followup",
      href: `/finances?chargeId=${overdueCharge.id}`,
      metadata: {
        amountCents: Number(overdueCharge.amountCents ?? 0),
      },
    });
  }

  const whatsappFailure = params.whatsappFailures?.[0];
  if (whatsappFailure?.id) {
    list.push({
      id: `wa-failure-${whatsappFailure.id}`,
      title: "Falha de mensagem WhatsApp",
      description: String(whatsappFailure.reason ?? "Mensagem não entregue para o cliente."),
      severity: "pending",
      entityType: "whatsapp",
      entityId: String(whatsappFailure.id),
      actionType: "resolve",
      href: `/whatsapp?customerId=${whatsappFailure.customerId ?? ""}`,
    });
  }

  return list.sort((a, b) => bySeverityScore(a.severity) - bySeverityScore(b.severity));
}

export function buildBottleneckGroups(input: {
  appointments: Array<{ status?: string | null }>;
  serviceOrders: Array<{ status?: string | null; financialSummary?: { hasCharge?: boolean | null } | null }>;
  charges: Array<{ status?: string | null }>;
}) {
  const scheduled = input.appointments.filter(item => normalizeStatus(item.status) === "SCHEDULED").length;
  const inProgress = input.serviceOrders.filter(item => normalizeStatus(item.status) === "IN_PROGRESS").length;
  const doneWithoutCharge = input.serviceOrders.filter(item => normalizeStatus(item.status) === "DONE" && !item.financialSummary?.hasCharge).length;
  const overdue = input.charges.filter(item => normalizeStatus(item.status) === "OVERDUE").length;

  return [
    { id: "appointments", label: "Agendamentos sem confirmação", value: scheduled, href: "/appointments" },
    { id: "execution", label: "O.S. em andamento", value: inProgress, href: "/service-orders" },
    { id: "billing", label: "O.S. concluídas sem cobrança", value: doneWithoutCharge, href: "/finances" },
    { id: "overdue", label: "Cobranças vencidas", value: overdue, href: "/finances" },
  ].sort((a, b) => b.value - a.value);
}

export function buildEntityContextBridge(input: {
  customerId?: string | null;
  appointmentId?: string | null;
  serviceOrderId?: string | null;
  chargeId?: string | null;
  paymentId?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.customerId) params.set("customerId", String(input.customerId));
  const customerQuery = params.toString();

  return [
    { id: "customer", label: "Cliente", href: customerQuery ? `/customers?${customerQuery}` : "/customers", active: Boolean(input.customerId) },
    { id: "appointment", label: "Agendamento", href: input.appointmentId ? `/appointments?appointmentId=${input.appointmentId}` : "/appointments", active: Boolean(input.appointmentId) },
    { id: "service-order", label: "Ordem de Serviço", href: input.serviceOrderId ? `/service-orders?id=${input.serviceOrderId}` : "/service-orders", active: Boolean(input.serviceOrderId) },
    { id: "charge", label: "Cobrança", href: input.chargeId ? `/finances?chargeId=${input.chargeId}` : "/finances", active: Boolean(input.chargeId) },
    { id: "payment", label: "Pagamento", href: input.paymentId ? `/finances?paymentId=${input.paymentId}` : "/finances", active: Boolean(input.paymentId) },
    { id: "whatsapp", label: "WhatsApp", href: input.customerId ? `/whatsapp?customerId=${input.customerId}` : "/whatsapp", active: Boolean(input.customerId) },
    { id: "timeline", label: "Timeline", href: input.customerId ? `/timeline?customerId=${input.customerId}` : "/timeline", active: Boolean(input.customerId) },
  ];
}
