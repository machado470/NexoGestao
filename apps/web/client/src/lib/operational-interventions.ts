import { getOperationalState, detectOperationalBottleneck, type OperationalHealthInput } from "@/lib/operational-health";
import { getOperationalPriorityScore } from "@/lib/operational-prioritization";
import { normalizeOperationalSeverity, type OperationalSeverity } from "@/lib/operational-semantics";

export type OperationalInterventionType =
  | "SEND_PAYMENT_REMINDER"
  | "PRIORITIZE_COLLECTION"
  | "FOLLOW_UP_CUSTOMER"
  | "CONFIRM_APPOINTMENT"
  | "REASSIGN_WORKLOAD"
  | "ESCALATE_OPERATIONAL_RISK"
  | "OPEN_SERVICE_ORDER"
  | "SCHEDULE_EXECUTION"
  | "RESOLVE_STALLED_FLOW"
  | "REVIEW_GOVERNANCE"
  | "CONTACT_UNRESPONSIVE_CUSTOMER"
  | "REVIEW_OVERDUE_ITEMS";

export type OperationalIntervention = {
  type: OperationalInterventionType;
  label: string;
  summary: string;
  reason: string;
  impact: string;
  priority: number;
  severity: OperationalSeverity;
  recommendedOwner: string;
  target?: { entityId?: string; module?: string };
  href?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
};

const status = (v: unknown) => String(v ?? "").toUpperCase().trim();
const toArray = <T = Record<string, unknown>>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);

const intervention = (item: Omit<OperationalIntervention, "priority"> & { priorityInput?: Parameters<typeof getOperationalPriorityScore>[0] }): OperationalIntervention => ({
  ...item,
  priority: getOperationalPriorityScore({ severity: item.severity, ...(item.priorityInput ?? {}) }).total,
});

export function detectOperationalInterventions(input: OperationalHealthInput): OperationalIntervention[] {
  const items: OperationalIntervention[] = [];
  const charges = toArray(input.charges);
  const customers = toArray(input.customers);
  const serviceOrders = toArray(input.serviceOrders);
  const appointments = toArray(input.appointments);
  const workload = [...toArray(input.people), ...toArray(input.workload)];

  const overdueCharges = charges.filter(c => status((c as any).status) === "OVERDUE");
  if (overdueCharges.length > 0) {
    const maxAmount = Math.max(...overdueCharges.map(c => Number((c as any).amountCents ?? 0)), 0);
    items.push(intervention({ type: "SEND_PAYMENT_REMINDER", label: "Enviar lembrete de pagamento", summary: "Cobranças vencidas precisam de contato imediato.", reason: `${overdueCharges.length} cobrança(s) vencida(s) detectadas.`, impact: "Reduz risco de inadimplência e acelera entrada de caixa.", severity: "WARNING", recommendedOwner: "Financeiro", href: "/finances?status=overdue", actionLabel: "Cobrar agora", priorityInput: { severity: "WARNING", amountCents: maxAmount, dueDate: (overdueCharges[0] as any)?.dueDate } }));
    items.push(intervention({ type: "PRIORITIZE_COLLECTION", label: "Priorizar carteira de cobrança", summary: "Focar primeiro nos atrasos com maior impacto.", reason: "Existem vencimentos ativos sem pagamento registrado.", impact: "Aumenta previsibilidade do caixa no curto prazo.", severity: "ATTENTION", recommendedOwner: "Financeiro", href: "/finances?status=overdue", priorityInput: { severity: "ATTENTION", amountCents: maxAmount } }));
  }

  const unresponsiveCustomers = customers.filter(c => Boolean((c as any).noResponse || (c as any).pendingResponse || (c as any).blockedByResponse));
  if (unresponsiveCustomers.length > 0) {
    items.push(intervention({ type: "FOLLOW_UP_CUSTOMER", label: "Fazer follow-up de cliente", summary: "Cliente sem resposta bloqueia avanço operacional.", reason: `${unresponsiveCustomers.length} cliente(s) sem resposta.`, impact: "Destrava decisões e reduz retrabalho.", severity: "ATTENTION", recommendedOwner: "Relacionamento", href: "/customers?filter=no_recent_contact", priorityInput: { customerNoResponse: true, severity: "ATTENTION" } }));
    items.push(intervention({ type: "CONTACT_UNRESPONSIVE_CUSTOMER", label: "Contatar cliente não responsivo", summary: "Recuperar comunicação para reduzir fila parada.", reason: "Interações pendentes estão bloqueando continuidade.", impact: "Acelera conversão cliente → execução.", severity: "WARNING", recommendedOwner: "Relacionamento", href: "/whatsapp", priorityInput: { customerNoResponse: true, hasCommunicationFailure: true, severity: "WARNING" } }));
  }

  const osDoneNoCharge = serviceOrders.filter(os => status((os as any).status) === "DONE" && !(os as any).chargeId);
  if (osDoneNoCharge.length > 0) {
    items.push(intervention({ type: "RESOLVE_STALLED_FLOW", label: "Resolver fluxo travado O.S. → Cobrança", summary: "Ordens concluídas sem cobrança vinculada.", reason: `${osDoneNoCharge.length} O.S. concluída(s) sem cobrança.`, impact: "Evita receita não faturada e destrava ciclo operacional.", severity: "CRITICAL", recommendedOwner: "Operações + Financeiro", href: "/service-orders?status=done", priorityInput: { severity: "CRITICAL", isBlocked: true } }));
  }

  const nearAppointments = appointments.filter(a => {
    const startsAt = new Date(String((a as any).startsAt ?? ""));
    if (Number.isNaN(startsAt.getTime())) return false;
    const hours = (startsAt.getTime() - Date.now()) / (1000 * 60 * 60);
    return hours >= 0 && hours <= 24 && !["CONFIRMED", "DONE", "COMPLETED"].includes(status((a as any).status));
  });
  if (nearAppointments.length > 0) {
    items.push(intervention({ type: "CONFIRM_APPOINTMENT", label: "Confirmar agendamento", summary: "Há agenda próxima sem confirmação.", reason: `${nearAppointments.length} agendamento(s) nas próximas 24h sem confirmação.`, impact: "Reduz no-show e ociosidade da equipe.", severity: "ATTENTION", recommendedOwner: "Operações", href: "/appointments?status=pending-confirmation", priorityInput: { severity: "ATTENTION", scheduledAt: (nearAppointments[0] as any)?.startsAt } }));
  }

  const overloaded = workload.filter(p => Number((p as any).utilization ?? (p as any).load ?? 0) >= 90);
  if (overloaded.length > 0) {
    items.push(intervention({ type: "REASSIGN_WORKLOAD", label: "Rebalancear carga operacional", summary: "Equipe acima da capacidade indicada.", reason: `${overloaded.length} recurso(s) com utilização >= 90%.`, impact: "Reduz gargalo humano e risco de atraso em cascata.", severity: "WARNING", recommendedOwner: "Coordenação", href: "/people", priorityInput: { severity: "WARNING", missingOwner: true } }));
  }

  const state = getOperationalState(input);
  const riskLevel = String(input.riskSummary?.level ?? "").toLowerCase();
  if (state === "CRITICAL" || riskLevel === "critical") {
    items.push(intervention({ type: "ESCALATE_OPERATIONAL_RISK", label: "Escalar risco operacional", summary: "Condição crítica exige resposta de liderança.", reason: `Estado operacional ${state}${riskLevel ? ` com risco ${riskLevel}` : ""}.`, impact: "Concentra decisão e reduz chance de interrupção operacional.", severity: "CRITICAL", recommendedOwner: "Gestão", href: "/governance", priorityInput: { severity: "CRITICAL", operationalRisk: "critical", isBlocked: true } }));
    items.push(intervention({ type: "REVIEW_GOVERNANCE", label: "Revisar governança operacional", summary: "Risco alto pede revisão de controles e prioridades.", reason: "Sinais críticos ativos no ciclo operacional.", impact: "Define contenção e alinhamento entre áreas.", severity: "WARNING", recommendedOwner: "Governança", href: "/governance", priorityInput: { severity: "WARNING", operationalRisk: "high" } }));
  }

  const bottleneck = detectOperationalBottleneck(input);
  if (bottleneck.bottleneck === "CHARGE_TO_PAYMENT" && overdueCharges.length > 0) {
    items.push(intervention({ type: "REVIEW_OVERDUE_ITEMS", label: "Revisar itens vencidos", summary: "Fluxo cobrança → pagamento está travado.", reason: bottleneck.reason, impact: "Remove pendências financeiras de maior risco primeiro.", severity: "WARNING", recommendedOwner: "Financeiro", href: "/finances?status=overdue", priorityInput: { severity: "WARNING", isBlocked: true } }));
  }

  return rankOperationalInterventions(items);
}

export function rankOperationalInterventions(items: OperationalIntervention[]) {
  return [...items].sort((a, b) => b.priority - a.priority);
}
export function getPrimaryOperationalIntervention(items: OperationalIntervention[]) { return rankOperationalInterventions(items)[0] ?? null; }
export function getOperationalInterventionReason(item: OperationalIntervention) { return item.reason; }
export function getOperationalInterventionImpact(item: OperationalIntervention) { return item.impact; }

export function shouldEscalateOperationalIntervention(item: OperationalIntervention) {
  const md = item.metadata ?? {};
  const overdueDays = Number(md.overdueDays ?? 0);
  const consecutiveFailures = Number(md.consecutiveFailures ?? 0);
  const strategicBlocked = Boolean(md.strategicCustomerBlocked);
  const highFinancialImpact = Number(md.amountCents ?? 0) >= 500_000;
  const critical = normalizeOperationalSeverity(item.severity) === "CRITICAL" || item.type === "ESCALATE_OPERATIONAL_RISK";

  if (critical) return { escalate: true, reason: "Risco crítico operacional ativo.", recommendedEscalation: "Escalar para liderança operacional e governança." };
  if (overdueDays >= 10) return { escalate: true, reason: `${overdueDays} dias de atraso acumulado.`, recommendedEscalation: "Escalar para coordenação financeira." };
  if (highFinancialImpact) return { escalate: true, reason: "Impacto financeiro elevado.", recommendedEscalation: "Escalar para gestão financeira." };
  if (consecutiveFailures >= 3) return { escalate: true, reason: "Múltiplas falhas consecutivas no fluxo.", recommendedEscalation: "Escalar para coordenação operacional." };
  if (strategicBlocked) return { escalate: true, reason: "Cliente estratégico está travado.", recommendedEscalation: "Escalar para gestão de contas estratégicas." };
  return { escalate: false, reason: "Sem sinal forte para escalonamento no momento.", recommendedEscalation: "Manter acompanhamento no nível operacional." };
}
