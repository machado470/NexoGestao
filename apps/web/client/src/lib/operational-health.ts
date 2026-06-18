import { getAttentionSummary, type OperationalAttentionItem } from "@/lib/operational-attention";
import { getOperationalPriorityScore } from "@/lib/operational-prioritization";
import { normalizeOperationalSeverity, operationalSeverityTone } from "@/lib/operational-semantics";

export type OperationalState = "HEALTHY" | "ATTENTION" | "CRITICAL" | "STALLED" | "DEGRADED" | "IMPROVING" | "UNKNOWN";
export type OperationalBottleneck =
  | "CUSTOMER_TO_APPOINTMENT"
  | "APPOINTMENT_TO_SERVICE_ORDER"
  | "SERVICE_ORDER_TO_CHARGE"
  | "CHARGE_TO_PAYMENT"
  | "COMMUNICATION_RESPONSE"
  | "PEOPLE_WORKLOAD"
  | "NONE"
  | "UNKNOWN";

type BaseRecord = Record<string, any>;
export type OperationalHealthInput = {
  customers?: BaseRecord[];
  appointments?: BaseRecord[];
  serviceOrders?: BaseRecord[];
  charges?: BaseRecord[];
  payments?: BaseRecord[];
  whatsapp?: BaseRecord[];
  conversations?: BaseRecord[];
  messages?: BaseRecord[];
  timelineEvents?: BaseRecord[];
  people?: BaseRecord[];
  workload?: BaseRecord[];
  riskSummary?: BaseRecord | null;
  governanceSummary?: BaseRecord | null;
  previous?: Partial<OperationalHealthInput>;
};

const statusSet = (value: unknown) => String(value ?? "").trim().toUpperCase();
const toArray = <T = BaseRecord>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const hasAnyData = (i: OperationalHealthInput) =>
  [i.customers, i.appointments, i.serviceOrders, i.charges, i.payments, i.whatsapp, i.conversations, i.messages, i.timelineEvents, i.people, i.workload].some(
    item => toArray(item).length > 0
  );

export function detectOperationalBottleneck(input: OperationalHealthInput) {
  const serviceOrders = toArray(input.serviceOrders);
  const charges = toArray(input.charges);
  const appointments = toArray(input.appointments);
  const customers = toArray(input.customers);
  const payments = toArray(input.payments);
  const messages = [...toArray(input.whatsapp), ...toArray(input.conversations), ...toArray(input.messages)];

  const concludedNoCharge = serviceOrders.filter(os => statusSet(os.status) === "DONE" && !os.chargeId).length;
  if (concludedNoCharge > 0) {
    return { bottleneck: "SERVICE_ORDER_TO_CHARGE" as const, label: "O.S. → Cobrança", reason: "Ordens concluídas sem cobrança vinculada.", affectedCount: concludedNoCharge, recommendedAction: "Gerar cobranças para O.S. concluídas." };
  }

  const overdueNoPayment = charges.filter(c => statusSet(c.status) === "OVERDUE" && toArray(c.payments).length === 0).length;
  if (overdueNoPayment > 0 || (charges.length > 0 && payments.length === 0 && charges.some(c => statusSet(c.status) !== "PAID"))) {
    return { bottleneck: "CHARGE_TO_PAYMENT" as const, label: "Cobrança → Pagamento", reason: "Cobranças vencidas ou pendentes sem pagamento registrado.", affectedCount: Math.max(overdueNoPayment, charges.filter(c => statusSet(c.status) !== "PAID").length), recommendedAction: "Ativar cobrança ativa e registrar recebimentos." };
  }

  const confirmedNoServiceOrder = appointments.filter(a => statusSet(a.status) === "CONFIRMED" && !a.serviceOrderId).length;
  if (confirmedNoServiceOrder > 0) {
    return { bottleneck: "APPOINTMENT_TO_SERVICE_ORDER" as const, label: "Agendamento → O.S.", reason: "Agendamentos confirmados sem O.S. criada.", affectedCount: confirmedNoServiceOrder, recommendedAction: "Criar O.S. para agendamentos confirmados." };
  }

  const customersNoResponse = customers.filter(c => Boolean(c.noResponse || c.pendingResponse || c.blockedByResponse)).length;
  const failedMessages = messages.filter(m => statusSet(m.status).includes("FAIL")).length;
  if (customersNoResponse > 0 || failedMessages > 0) {
    return { bottleneck: "COMMUNICATION_RESPONSE" as const, label: "Comunicação", reason: "Clientes sem resposta e/ou falhas de WhatsApp bloqueando avanço.", affectedCount: customersNoResponse + failedMessages, recommendedAction: "Retomar contato e corrigir falhas de envio." };
  }

  if (toArray(input.people).length > 0 || toArray(input.workload).length > 0) {
    const overloaded = [...toArray(input.people), ...toArray(input.workload)].filter(item => Number(item.utilization ?? item.load ?? 0) >= 90).length;
    if (overloaded > 0) {
      return { bottleneck: "PEOPLE_WORKLOAD" as const, label: "Carga da equipe", reason: "Equipe operando acima da capacidade.", affectedCount: overloaded, recommendedAction: "Redistribuir carteira e priorizar backlog crítico." };
    }
  }

  if (customers.length === 0 && appointments.length > 0) {
    return { bottleneck: "CUSTOMER_TO_APPOINTMENT" as const, label: "Cliente → Agendamento", reason: "Há agendamentos sem contexto confiável de cliente.", affectedCount: appointments.length, recommendedAction: "Reconciliar dados de cliente e agenda." };
  }

  if (!hasAnyData(input)) {
    return { bottleneck: "UNKNOWN" as const, label: "Indeterminado", reason: "Dados insuficientes para detectar gargalo.", affectedCount: 0, recommendedAction: "Carregar mais contexto operacional." };
  }

  return { bottleneck: "NONE" as const, label: "Sem gargalo claro", reason: "Fluxo principal sem bloqueio dominante no momento.", affectedCount: 0, recommendedAction: "Manter monitoramento contínuo." };
}

export function getOperationalPressure(input: OperationalHealthInput) {
  const charges = toArray(input.charges);
  const serviceOrders = toArray(input.serviceOrders);
  const messages = [...toArray(input.whatsapp), ...toArray(input.conversations), ...toArray(input.messages)];
  const attentionItems: OperationalAttentionItem[] = [];

  for (const charge of charges) {
    const status = statusSet(charge.status);
    if (status === "OVERDUE" || status === "PENDING") attentionItems.push({ severity: status === "OVERDUE" ? "WARNING" : "ATTENTION", amountCents: Number(charge.amountCents ?? 0), dueDate: charge.dueDate, domain: "finances", type: "charge" });
  }
  for (const os of serviceOrders) {
    const status = statusSet(os.status);
    if (["OPEN", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "LATE"].includes(status)) attentionItems.push({ severity: status === "BLOCKED" ? "CRITICAL" : "ATTENTION", isBlocked: status === "BLOCKED", domain: "service_orders", type: "service_order" });
  }
  for (const message of messages) {
    const severity = normalizeOperationalSeverity(message.severity ?? message.status);
    if (severity === "CRITICAL" || severity === "WARNING") attentionItems.push({ severity, hasCommunicationFailure: true, domain: "whatsapp", type: "communication" });
  }

  const summary = getAttentionSummary(attentionItems);
  const priority = attentionItems.map(item => getOperationalPriorityScore(item).total).reduce((acc, v) => acc + v, 0);
  return { attention: summary, priorityScore: priority, pressureLevel: priority >= 500 ? "high" : priority >= 220 ? "medium" : "low" } as const;
}

export function getOperationalMomentum(input: OperationalHealthInput) {
  if (!input.previous) return { trend: "STABLE", delta: 0, basis: "Sem baseline anterior confiável." } as const;
  const currentPressure = getOperationalPressure(input).priorityScore;
  const previousPressure = getOperationalPressure(input.previous as OperationalHealthInput).priorityScore;
  const delta = currentPressure - previousPressure;
  if (delta >= 60) return { trend: "WORSENING", delta, basis: "Aumento relevante de pressão operacional." } as const;
  if (delta <= -60) return { trend: "IMPROVING", delta, basis: "Redução consistente de pressão operacional." } as const;
  return { trend: "STABLE", delta, basis: "Oscilação pequena sem tendência clara." } as const;
}

const STATE_META = {
  HEALTHY: { label: "Operação saudável", summary: "Operação fluindo com baixa fricção.", explanation: "Poucos alertas ativos, atrasos controlados e comunicação estável.", recommendedFocus: "Manter rotina e prevenir novos atrasos." },
  ATTENTION: { label: "Atenção necessária", summary: "Pendências pedem acompanhamento.", explanation: "Há sinais de atraso, pendências ou confirmações faltantes.", recommendedFocus: "Reduzir backlog e antecipar follow-ups." },
  CRITICAL: { label: "Condição crítica", summary: "Risco operacional elevado.", explanation: "Múltiplos sinais graves: vencimentos altos, bloqueios e falhas de comunicação.", recommendedFocus: "Atuar nos itens críticos do dia." },
  STALLED: { label: "Operação travada", summary: "Fluxo interrompido por gargalo dominante.", explanation: "Há ruptura entre etapas do funil operacional, impedindo avanço natural.", recommendedFocus: "Destravar o gargalo principal imediatamente." },
  DEGRADED: { label: "Degradando", summary: "Operação piorando frente ao período anterior.", explanation: "Tendência de aumento de atrasos, falhas ou vencimentos.", recommendedFocus: "Conter deterioração e restaurar estabilidade." },
  IMPROVING: { label: "Melhorando", summary: "Operação evoluindo com redução de fricções.", explanation: "Queda de pendências, vencimentos ou falhas frente ao baseline.", recommendedFocus: "Consolidar melhorias e evitar recaída." },
  UNKNOWN: { label: "Indeterminado", summary: "Dados insuficientes para leitura confiável.", explanation: "Não há volume mínimo de sinais para classificar a saúde operacional.", recommendedFocus: "Completar contexto operacional antes de decidir." },
} as const;

export function getOperationalState(input: OperationalHealthInput): OperationalState {
  if (!hasAnyData(input)) return "UNKNOWN";
  const bottleneck = detectOperationalBottleneck(input);
  const pressure = getOperationalPressure(input);
  const momentum = getOperationalMomentum(input);
  const riskHigh = ["high", "critical"].includes(String(input.riskSummary?.level ?? "").toLowerCase());
  if (["SERVICE_ORDER_TO_CHARGE", "CHARGE_TO_PAYMENT", "APPOINTMENT_TO_SERVICE_ORDER", "COMMUNICATION_RESPONSE"].includes(bottleneck.bottleneck) && bottleneck.affectedCount > 0) return "STALLED";
  if (riskHigh || pressure.pressureLevel === "high") return "CRITICAL";
  if (momentum.trend === "WORSENING") return "DEGRADED";
  if (momentum.trend === "IMPROVING") return "IMPROVING";
  if (pressure.pressureLevel === "medium") return "ATTENTION";
  return "HEALTHY";
}

export function getOperationalHealthSummary(input: OperationalHealthInput) {
  const state = getOperationalState(input);
  const bottleneck = detectOperationalBottleneck(input);
  const pressure = getOperationalPressure(input);
  const momentum = getOperationalMomentum(input);
  const meta = STATE_META[state];
  return { state, tone: operationalSeverityTone(state === "CRITICAL" ? "CRITICAL" : state === "ATTENTION" ? "WARNING" : "NORMAL"), severity: state, label: meta.label, summary: meta.summary, explanation: `${meta.explanation} ${bottleneck.reason}`, recommendedFocus: bottleneck.bottleneck === "NONE" ? meta.recommendedFocus : `${meta.recommendedFocus} ${bottleneck.recommendedAction}`, bottleneck, pressure, momentum };
}

export function aggregateOperationalHealth(input: OperationalHealthInput) {
  return getOperationalHealthSummary(input);
}
