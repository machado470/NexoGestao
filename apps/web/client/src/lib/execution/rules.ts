import type {
  ExecutionLog,
  ExecutionPlan,
  ExecutionSeverity,
  OperationalDecision,
} from "@/lib/execution/types";
import { buildWhatsAppUrlFromCharge } from "@/lib/operations/operations.utils";

export type DashboardExecutionFacts = {
  totalCustomers: number;
  totalServiceOrders: number;
  completedOrders: number;
  chargesGenerated: number;
  overdueCharges: number;
  todayAppointments: number;
  hasWhatsappContext: boolean;
  doneWithoutChargeCandidate?: {
    serviceOrderId: string;
    customerName?: string | null;
    amountCents?: number | null;
    daysOverdue?: number | null;
  } | null;
  overdueChargeCandidate?: {
    chargeId: string;
    customerId?: string | null;
    customerName?: string | null;
    amountCents?: number | null;
    daysOverdue?: number | null;
    dueDate?: string | null;
  } | null;
  executionLogs?: ExecutionLog[];
};

function severityWeight(severity: ExecutionSeverity) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

export function sortDecisions(decisions: OperationalDecision[]) {
  return [...decisions].sort((a, b) => {
    const severityDiff = severityWeight(a.severity) - severityWeight(b.severity);
    if (severityDiff !== 0) return severityDiff;
    return (b.priority ?? 0) - (a.priority ?? 0);
  });
}

export function buildDashboardRules(facts: DashboardExecutionFacts): OperationalDecision[] {
  const decisions: OperationalDecision[] = [];
  const executed = new Set(
    (facts.executionLogs ?? [])
      .filter(log => log.status === "success")
      .map(log => `${log.decisionId}:${log.actionId}`)
  );

  const wasExecuted = (decisionId: string, actionId: string) =>
    executed.has(`${decisionId}:${actionId}`);

  const doneWithoutCharge = Math.max(
    facts.completedOrders - facts.chargesGenerated,
    0
  );

  if (doneWithoutCharge > 0) {
    const candidateCustomer = facts.doneWithoutChargeCandidate?.customerName?.trim();
    const candidateValue = Number(facts.doneWithoutChargeCandidate?.amountCents ?? 0) / 100;

    decisions.push({
      id: "decision-done-without-charge",
      entityType: "serviceOrder",
      entityId: "batch-done-without-charge",
      severity: "critical",
      state: "invalid",
      title: "O.S. concluída sem cobrança",
      summary: candidateCustomer
        ? `${candidateCustomer} tem ${new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(candidateValue)} pendente por serviço concluído sem cobrança. Impacto direto no caixa.`
        : `${doneWithoutCharge} serviço(s) concluído(s) sem cobrança vinculada, bloqueando entrada de caixa.`,
      reasonCodes: ["service_order_done_without_charge", "revenue_blocked"],
      suggestedActionId: "action-generate-charge",
      priority: 100,
      impactScore: 98,
      urgencyScore: 92,
      contextualPriority: "critical",
      actions: [
        {
          id: "action-generate-charge",
          kind:
            facts.doneWithoutChargeCandidate?.serviceOrderId
              ? "mutation"
              : "navigate",
          intent: "primary",
          label: facts.doneWithoutChargeCandidate?.serviceOrderId
            ? "Gerar cobrança agora"
            : "Gerar cobrança",
          description: facts.doneWithoutChargeCandidate?.serviceOrderId
            ? "Executar geração de cobrança da O.S. crítica."
            : "Abrir financeiro com foco em cobrança.",
          enabled: true,
          target: "/finances?filter=ready_to_charge",
          mutationKey: facts.doneWithoutChargeCandidate?.serviceOrderId
            ? "service_order.generate_charge"
            : undefined,
          payload: facts.doneWithoutChargeCandidate?.serviceOrderId
            ? { serviceOrderId: facts.doneWithoutChargeCandidate.serviceOrderId }
            : undefined,
          telemetryKey: "execution.generate_charge_from_dashboard",
          mode: "semi_automatic",
          safetyLevel: "low",
          autoWhenPossible: true,
        },
        {
          id: "action-open-service-orders",
          kind: "navigate",
          intent: "secondary",
          label: "Revisar O.S.",
          enabled: true,
          target: "/service-orders",
          telemetryKey: "execution.open_service_orders_from_dashboard",
          mode: "manual",
          safetyLevel: "low",
        },
      ],
    });
  }

  if (facts.overdueCharges > 0) {
    decisions.push({
      id: "decision-overdue-charge",
      entityType: "charge",
      entityId: "batch-overdue-charge",
      severity: "critical",
      state: "ready",
      title: "Cobranças vencidas exigem recuperação",
      summary: facts.overdueChargeCandidate?.customerName
        ? `${facts.overdueChargeCandidate.customerName} tem ${new Intl.NumberFormat(
            "pt-BR",
            { style: "currency", currency: "BRL" }
          ).format(Number(facts.overdueChargeCandidate.amountCents ?? 0) / 100)} em aberto há ${Math.max(
            Number(facts.overdueChargeCandidate.daysOverdue ?? 0),
            0
          )} dia(s), com impacto direto no caixa.`
        : `${facts.overdueCharges} cobrança(s) vencida(s) com impacto direto no caixa.`,
      reasonCodes: ["charge_overdue", "cashflow_risk"],
      suggestedActionId: "action-open-finance-overdue",
      priority: 95,
      impactScore: 90,
      urgencyScore: 95,
      contextualPriority: "critical",
      actions: [
        {
          id: "action-open-finance-overdue",
          kind: "navigate",
          intent: "primary",
          label: "Abrir financeiro",
          description: "Filtrar cobranças vencidas para recuperação.",
          enabled: true,
          target: "/finances?filter=overdue",
          telemetryKey: "execution.open_finance_overdue",
          mode: "manual",
          safetyLevel: "low",
        },
        {
          id: "action-charge-on-whatsapp",
          kind: "external",
          intent: "secondary",
          label: "Cobrar no WhatsApp",
          enabled: Boolean(
            facts.overdueChargeCandidate && buildWhatsAppUrlFromCharge(facts.overdueChargeCandidate)
          ),
          disabledReason:
            "Selecione uma cobrança com cliente identificado para abrir o WhatsApp com contexto.",
          externalUrl:
            buildWhatsAppUrlFromCharge(facts.overdueChargeCandidate) ?? undefined,
          telemetryKey: "execution.open_whatsapp_for_charge",
          mode: "automatic",
          safetyLevel: "low",
          autoWhenPossible: true,
        },
        {
          id: "action-mark-charge-paid",
          kind: "mutation",
          intent: "secondary",
          label: "Registrar pagamento",
          enabled: Boolean(
            facts.overdueChargeCandidate?.chargeId &&
              typeof facts.overdueChargeCandidate?.amountCents === "number"
          ),
          mutationKey: "finance.charge.mark_paid",
          payload: facts.overdueChargeCandidate?.chargeId
            ? {
                chargeId: facts.overdueChargeCandidate.chargeId,
                amountCents: facts.overdueChargeCandidate.amountCents ?? 0,
              }
            : undefined,
          telemetryKey: "execution.mark_charge_paid",
          mode: "semi_automatic",
          safetyLevel: "high",
          requiresConfirmation: true,
        },
      ],
    });
  }

  if (!facts.hasWhatsappContext) {
    decisions.push({
      id: "decision-whatsapp-without-context",
      entityType: "system",
      entityId: "whatsapp-context",
      severity: "warning",
      state: "blocked",
      title: "WhatsApp sem contexto operacional",
      summary:
        "Para evitar mensagens genéricas, inicie por uma O.S. ou cobrança antes de abrir a conversa.",
      reasonCodes: ["whatsapp_context_missing"],
      suggestedActionId: "action-start-from-service-order",
      priority: 70,
      impactScore: 60,
      urgencyScore: 45,
      contextualPriority: "medium",
      actions: [
        {
          id: "action-start-from-service-order",
          kind: "navigate",
          intent: "primary",
          label: "Começar por O.S.",
          enabled: true,
          target: "/service-orders",
          telemetryKey: "execution.start_whatsapp_from_service_order",
          mode: "manual",
          safetyLevel: "low",
        },
        {
          id: "action-start-from-charge",
          kind: "navigate",
          intent: "secondary",
          label: "Começar por cobrança",
          enabled: true,
          target: "/finances",
          telemetryKey: "execution.start_whatsapp_from_finance",
          mode: "manual",
          safetyLevel: "low",
        },
      ],
    });
  }

  if (facts.todayAppointments > 0) {
    decisions.push({
      id: "decision-today-appointments",
      entityType: "appointment",
      entityId: "today-appointments",
      severity: "warning",
      state: "ready",
      title: "Agendamentos de hoje aguardam execução",
      summary: `${facts.todayAppointments} agendamento(s) com janela de execução ativa hoje e impacto na experiência do cliente.`,
      reasonCodes: ["today_appointments"],
      suggestedActionId: "action-open-appointments",
      priority: 65,
      impactScore: 72,
      urgencyScore: 70,
      contextualPriority: "high",
      actions: [
        {
          id: "action-open-appointments",
          kind: "navigate",
          intent: "primary",
          label: "Executar agenda",
          enabled: true,
          target: "/appointments",
          telemetryKey: "execution.open_today_appointments",
          mode: "manual",
          safetyLevel: "low",
        },
      ],
    });
  }

  const hasOperations = facts.totalCustomers > 0 || facts.totalServiceOrders > 0;
  if (!hasOperations) {
    decisions.push({
      id: "decision-empty-dashboard",
      entityType: "system",
      entityId: "onboarding-start",
      severity: "normal",
      state: "ready",
      title: "Operação ainda não iniciada",
      summary:
        "Comece criando cliente e primeiro agendamento para iniciar o ciclo Cliente → O.S. → Cobrança.",
      reasonCodes: ["empty_dashboard"],
      suggestedActionId: "action-create-customer",
      priority: 30,
      impactScore: 35,
      urgencyScore: 20,
      contextualPriority: "low",
      actions: [
        {
          id: "action-create-customer",
          kind: "navigate",
          intent: "primary",
          label: "Criar cliente",
          enabled: true,
          target: "/customers",
          telemetryKey: "execution.create_customer_first",
          mode: "manual",
          safetyLevel: "low",
        },
        {
          id: "action-create-appointment",
          kind: "navigate",
          intent: "secondary",
          label: "Agendar primeiro serviço",
          enabled: true,
          target: "/appointments",
          telemetryKey: "execution.create_first_appointment",
          mode: "manual",
          safetyLevel: "low",
        },
      ],
    });
  }

  const healthyDecision: OperationalDecision = {
    id: "decision-operational-healthy",
    entityType: "system",
    entityId: "operational-healthy",
    severity: "normal",
    state: "completed",
    title: "Fluxo operacional estável",
    summary: "Sem bloqueios imediatos na execução operacional agora.",
    reasonCodes: ["healthy_flow"],
    suggestedActionId: "action-review-dashboard",
    priority: 1,
    impactScore: 10,
    urgencyScore: 10,
    contextualPriority: "low",
    actions: [
      {
        id: "action-review-dashboard",
        kind: "future",
        intent: "secondary",
        label: "Manter monitoramento",
        enabled: true,
        telemetryKey: "execution.keep_monitoring",
        mode: "automatic",
        safetyLevel: "low",
        autoWhenPossible: true,
      },
    ],
  };

  if (decisions.length === 0) {
    decisions.push(healthyDecision);
  }

  const filtered = decisions.reduce<OperationalDecision[]>((acc, decision) => {
    const actions = decision.actions.filter(action => !wasExecuted(decision.id, action.id));
    if (actions.length === 0) return acc;

    acc.push({
      ...decision,
      actions,
      suggestedActionId: actions.some(action => action.id === decision.suggestedActionId)
        ? decision.suggestedActionId
        : actions[0]?.id,
    });

    return acc;
  }, []);

  if (filtered.length === 0) {
    return [healthyDecision];
  }

  return sortDecisions(filtered);
}

export function withSortedDecisions(plan: ExecutionPlan): ExecutionPlan {
  return {
    ...plan,
    decisions: sortDecisions(plan.decisions),
  };
}
