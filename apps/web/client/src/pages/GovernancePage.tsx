import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { AppStatCard, AppTimeline, AppTimelineItem, AppToolbar } from "@/components/app-system";
import {
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppPageShell,
  AppPriorityBadge,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { setBootPhase } from "@/lib/bootPhase";

type PriorityLevel = "critical" | "high" | "medium";
type OperationalState = "healthy" | "attention" | "critical" | "empty" | "loading" | "error";
type GovernanceStateTone = "NORMAL" | "WARNING" | "RESTRICTED" | "SUSPENDED";
type ActionType = "charge" | "message" | "assignment" | "schedule";
type ActionContext = Record<string, unknown>;

type GovernanceProblem = {
  id: string;
  title: string;
  context: string;
  impact: string;
  origin: string;
  owner: string;
  module: "customers" | "finances" | "service-orders" | "appointments" | "whatsapp" | "timeline";
  priority: PriorityLevel;
  count: number;
  actionLabel: string;
  actionPath: string;
  timelinePath: string;
  reason: string;
  expectedImpact: string;
};

type GovernanceActionItem = {
  id: string;
  type: "alert" | "suggestion" | "restriction" | "state-change" | "prioritization" | "correction";
  title: string;
  reason: string;
  impact: string;
  when: string;
  ctaLabel: string;
  ctaPath: string;
  timelinePath: string;
  priority: PriorityLevel;
};

type GovernanceExecutionItem = {
  id: string;
  event: "GOVERNANCE_RUN_STARTED" | "GOVERNANCE_RUN_COMPLETED" | "OPERATIONAL_STATE_CHANGED";
  title: string;
  summary: string;
  occurredAt: string;
  riskScore: number;
  stateLabel: GovernanceStateTone;
  timelinePath: string;
};

type GovernanceDetail = {
  id: string;
  title: string;
  state: GovernanceStateTone;
  reason: string;
  changed: string;
  possibleNext: string;
  signals: string[];
  impactedEntities: Array<{ label: string; path: string }>;
  relatedEvents: string[];
  executedActions: string[];
  crossLinks: Array<{ label: string; path: string }>;
};

type Action = {
  id: string;
  type: ActionType;
  label: string;
  description: string;
  execute: (context: ActionContext) => Promise<void>;
  requiresConfirmation?: boolean;
};

function metric(summary: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(summary?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function severityWeight(priority: PriorityLevel) {
  if (priority === "critical") return 3;
  if (priority === "high") return 2;
  return 1;
}

function operationStateFromRisk(riskScore: number, hasCritical: boolean, hasAnyProblem: boolean): OperationalState {
  if (!hasAnyProblem && riskScore <= 0) return "empty";
  if (hasCritical || riskScore >= 70) return "critical";
  if (riskScore >= 40 || hasAnyProblem) return "attention";
  return "healthy";
}

function operationalToneFromState(state: OperationalState): GovernanceStateTone {
  if (state === "critical") return "SUSPENDED";
  if (state === "attention") return "WARNING";
  if (state === "healthy") return "NORMAL";
  return "RESTRICTED";
}

function operationStateLabel(state: OperationalState) {
  if (state === "critical") return "Crítico";
  if (state === "attention") return "Atenção";
  if (state === "healthy") return "Saudável";
  if (state === "loading") return "Carregando";
  if (state === "error") return "Falha";
  return "Saudável";
}

function operationSummaryCopy(state: OperationalState, problemCount: number) {
  if (state === "critical") {
    return `Operação em risco alto com ${problemCount} sinal(is) exigindo intervenção imediata.`;
  }
  if (state === "attention") {
    return `Operação em atenção com ${problemCount} sinal(is) que podem escalar nas próximas horas.`;
  }
  if (state === "healthy") {
    return "Operação saudável no momento. Governança segue em supervisão contínua.";
  }
  if (state === "empty") {
    return "Sem desvios detectados nesta janela. Governança mantém monitoramento ativo.";
  }
  if (state === "loading") return "Lendo sinais operacionais para consolidar estado e reação.";
  return "Não foi possível consolidar o estado operacional agora.";
}

function toneDescription(state: GovernanceStateTone) {
  if (state === "SUSPENDED") return "Restrições fortes em curso para conter risco operacional.";
  if (state === "RESTRICTED") return "Operação parcialmente limitada enquanto ações corretivas executam.";
  if (state === "WARNING") return "Risco crescente pede ação rápida para evitar escalada.";
  return "Operação controlada, sem restrições no momento.";
}

export default function GovernancePage() {
  setBootPhase("PAGE:Governança");
  useRenderWatchdog("GovernancePage");

  const [, navigate] = useLocation();
  const summaryQuery = trpc.governance.summary.useQuery(undefined, { retry: false });
  const runsQuery = trpc.governance.runs.useQuery({ limit: 12 }, { retry: false });
  const peopleQuery = trpc.people.list.useQuery(undefined, { retry: false });
  const overdueChargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 10, status: "OVERDUE" },
    { retry: false }
  );
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 20, status: "OPEN" },
    { retry: false }
  );
  const executeGovernanceAction = trpc.governance.executeAction.useMutation();

  const [searchValue, setSearchValue] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | PriorityLevel>("all");
  const [periodFilter, setPeriodFilter] = useState<"24h" | "7d" | "30d">("7d");
  const [selectedDetailId, setSelectedDetailId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<Record<string, { state: "idle" | "loading" | "success" | "error"; message?: string }>>({});

  const summary = useMemo(
    () => (normalizeObjectPayload<any>(summaryQuery.data) ?? {}) as Record<string, any>,
    [summaryQuery.data]
  );
  const runs = useMemo(() => normalizeArrayPayload<any>(runsQuery.data), [runsQuery.data]);
  const people = useMemo(() => normalizeArrayPayload<any>(peopleQuery.data), [peopleQuery.data]);
  const overdueChargesList = useMemo(
    () => normalizeArrayPayload<any>((overdueChargesQuery.data as any)?.data ?? overdueChargesQuery.data ?? []),
    [overdueChargesQuery.data]
  );
  const serviceOrders = useMemo(() => {
    const payload = normalizeObjectPayload<any>(serviceOrdersQuery.data) ?? {};
    return normalizeArrayPayload<any>(payload.data ?? payload.items ?? serviceOrdersQuery.data ?? []);
  }, [serviceOrdersQuery.data]);

  const hasSummaryData = Boolean(summaryQuery.data);
  const hasRunsData = runs.length > 0;

  const entitiesAtRisk = normalizeArrayPayload<any>(summary.entitiesAtRisk ?? summary.riskEntities ?? []);
  const recommendations = normalizeArrayPayload<any>(summary.recommendations ?? summary.nextActions ?? []);
  const failures = normalizeArrayPayload<any>(summary.operationalFailures ?? summary.failures ?? []);
  const institutionalPolicies = normalizeArrayPayload<any>(summary.policies ?? summary.institutionalPolicies ?? []);

  const overdueServiceOrders = metric(summary, "overdueServiceOrders", "serviceOrdersOverdue", "lateServiceOrders", "overdueOs");
  const overdueCharges = metric(summary, "overdueCharges", "chargesOverdue", "openOverdueCharges", "billingOverdue");
  const unansweredCustomers = metric(summary, "unansweredCustomers", "customersWithoutResponse", "pendingCustomerReplies");
  const communicationFailures = metric(summary, "communicationFailures", "failedMessages", "whatsappFailures", "failedNotifications");
  const overloadedWorkload = metric(summary, "overloadedTeams", "workloadPressure", "teamOverload", "overloadCount");

  const latestRisk = Number(
    runs[0]?.riskScore ?? runs[0]?.score ?? runs[0]?.overallRisk ?? metric(summary, "riskScore", "overallRisk", "operationalRisk")
  );

  const detectedProblems = useMemo<GovernanceProblem[]>(() => {
    const problems: GovernanceProblem[] = [];

    if (overdueServiceOrders > 0) {
      problems.push({
        id: "problem-overdue-service-orders",
        title: `${overdueServiceOrders} O.S. atrasadas`,
        context: `${overdueServiceOrders} ordem(ns) estão fora do prazo e já impactam execução do turno.`,
        impact: "Atraso em cadeia no atendimento e degradação de SLA.",
        origin: "Timeline · eventos de O.S. sem conclusão no prazo.",
        owner: "Operações",
        module: "service-orders",
        priority: overdueServiceOrders >= 5 ? "critical" : "high",
        count: overdueServiceOrders,
        actionLabel: "Redistribuir O.S.",
        actionPath: "/service-orders?status=attention",
        timelinePath: "/timeline?module=service_order&severity=critical",
        reason: "O atraso já afeta a capacidade do time e compromete janelas seguintes.",
        expectedImpact: "Reduz fila atrasada e estabiliza cronograma do dia.",
      });
    }

    if (overdueCharges > 0) {
      problems.push({
        id: "problem-overdue-charges",
        title: `${overdueCharges} cobrança(s) vencida(s)`,
        context: `${overdueCharges} cobrança(s) já passaram do prazo de recebimento.`,
        impact: "Risco direto de caixa e atraso no ciclo financeiro.",
        origin: "Timeline · eventos de cobrança não quitada.",
        owner: "Financeiro",
        module: "finances",
        priority: overdueCharges >= 4 ? "critical" : "high",
        count: overdueCharges,
        actionLabel: "Cobrar clientes vencidos",
        actionPath: "/finances?view=charges&status=overdue",
        timelinePath: "/timeline?module=finance&severity=critical",
        reason: "Cobrança vencida aumenta exposição financeira a cada dia.",
        expectedImpact: "Melhora caixa do dia e reduz inadimplência acumulada.",
      });
    }

    if (unansweredCustomers > 0) {
      problems.push({
        id: "problem-unanswered-customers",
        title: `${unansweredCustomers} cliente(s) sem resposta`,
        context: `${unansweredCustomers} cliente(s) aguardam retorno e podem abandonar o fluxo.`,
        impact: "Queda de conversão e risco de cancelamento.",
        origin: "Timeline · eventos de follow-up sem resposta.",
        owner: "Relacionamento",
        module: "customers",
        priority: unansweredCustomers >= 6 ? "high" : "medium",
        count: unansweredCustomers,
        actionLabel: "Responder pendências",
        actionPath: "/customers?segment=needs-contact",
        timelinePath: "/timeline?module=customer&severity=medium",
        reason: "Cliente sem retorno perde confiança e tende a sair do funil.",
        expectedImpact: "Recupera relacionamento e eleva chance de continuidade.",
      });
    }

    if (communicationFailures > 0) {
      problems.push({
        id: "problem-communication-failures",
        title: `${communicationFailures} falha(s) de comunicação`,
        context: `${communicationFailures} envio(s) com erro em mensagens operacionais recentes.`,
        impact: "Confirmações não chegam e aumenta ausência em agenda.",
        origin: "Timeline · falhas em notificações e WhatsApp.",
        owner: "Comunicação",
        module: "whatsapp",
        priority: communicationFailures >= 4 ? "high" : "medium",
        count: communicationFailures,
        actionLabel: "Reenviar mensagens",
        actionPath: "/timeline?type=whatsapp-failure",
        timelinePath: "/timeline?module=whatsapp&severity=high",
        reason: "Sem comunicação entregue, o restante do fluxo perde previsibilidade.",
        expectedImpact: "Recupera confirmações e reduz retrabalho de equipe.",
      });
    }

    if (overloadedWorkload > 0) {
      problems.push({
        id: "problem-overloaded-workload",
        title: "Equipe sobrecarregada hoje",
        context: `${overloadedWorkload} sinal(is) de sobrecarga detectado(s) no turno atual.`,
        impact: "Aumenta risco de atraso, erro operacional e queda de qualidade.",
        origin: "Timeline · concentração de tarefas e bloqueios no fluxo.",
        owner: "Coordenação operacional",
        module: "appointments",
        priority: overloadedWorkload >= 3 ? "high" : "medium",
        count: overloadedWorkload,
        actionLabel: "Ajustar agenda",
        actionPath: "/appointments?view=calendar",
        timelinePath: "/timeline?module=appointment&severity=high",
        reason: "Carga excessiva compromete tempo de resposta e execução com qualidade.",
        expectedImpact: "Distribui demanda e evita efeito cascata em O.S. e atendimento.",
      });
    }

    entitiesAtRisk.slice(0, 3).forEach((entity, index) => {
      const entityName = String(entity?.name ?? entity?.entityName ?? "Entidade em risco");
      const entityLevel = String(entity?.level ?? entity?.riskLevel ?? "WARNING").toUpperCase();
      problems.push({
        id: `entity-risk-${index}`,
        title: `${entityName} em risco`,
        context: String(entity?.reason ?? entity?.context ?? "Entidade com comportamento fora do padrão operacional."),
        impact: "Pode gerar bloqueio operacional se não houver resposta imediata.",
        origin: "Timeline · alerta de governança por entidade.",
        owner: String(entity?.owner ?? "Governança"),
        module: "timeline",
        priority: entityLevel === "CRITICAL" || entityLevel === "HIGH" ? "critical" : "medium",
        count: 1,
        actionLabel: "Ver origem na timeline",
        actionPath: "/timeline?module=governance",
        timelinePath: "/timeline?module=governance",
        reason: "O alerta foi escalado pela governança e precisa de decisão.",
        expectedImpact: "Evita propagação do risco para outros módulos.",
      });
    });

    return problems.sort((a, b) => {
      const bySeverity = severityWeight(b.priority) - severityWeight(a.priority);
      if (bySeverity !== 0) return bySeverity;
      return b.count - a.count;
    });
  }, [communicationFailures, entitiesAtRisk, overdueCharges, overdueServiceOrders, overloadedWorkload, unansweredCustomers]);

  const filteredProblems = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return detectedProblems.filter(problem => {
      const matchesPriority = priorityFilter === "all" || problem.priority === priorityFilter;
      if (!matchesPriority) return false;
      if (!query) return true;
      return (
        problem.title.toLowerCase().includes(query) ||
        problem.context.toLowerCase().includes(query) ||
        problem.owner.toLowerCase().includes(query) ||
        problem.impact.toLowerCase().includes(query)
      );
    });
  }, [detectedProblems, priorityFilter, searchValue]);

  const hasCritical = detectedProblems.some(problem => problem.priority === "critical");
  const effectiveState = operationStateFromRisk(latestRisk, hasCritical, detectedProblems.length > 0);
  const governanceTone = operationalToneFromState(effectiveState);

  const actionItems = useMemo<GovernanceActionItem[]>(() => {
    const base: GovernanceActionItem[] = filteredProblems.map(problem => ({
      id: `system-action-${problem.id}`,
      type: (problem.priority === "critical" ? "restriction" : "suggestion") as GovernanceActionItem["type"],
      title: problem.actionLabel,
      reason: problem.reason,
      impact: problem.expectedImpact,
      when: "Agora",
      ctaLabel: "Executar investigação",
      ctaPath: problem.actionPath,
      timelinePath: problem.timelinePath,
      priority: problem.priority,
    }));

    if (effectiveState === "critical") {
      base.unshift({
        id: "system-action-state-change",
        type: "state-change",
        title: "Mudança de estado operacional aplicada",
        reason: "Risco consolidado acima do limiar crítico com sinais simultâneos em O.S. e Financeiro.",
        impact: "Bloqueia propagação do risco e força priorização de backlog crítico.",
        when: "Última execução",
        ctaLabel: "Abrir Timeline da mudança",
        ctaPath: "/timeline?module=governance&event=OPERATIONAL_STATE_CHANGED",
        timelinePath: "/timeline?module=governance",
        priority: "critical",
      });
    }

    return base.slice(0, 8);
  }, [effectiveState, filteredProblems]);

  const executions = useMemo<GovernanceExecutionItem[]>(() => {
    if (runs.length === 0) return [];

    const items = runs.slice(0, 8).flatMap((run, index) => {
      const runId = String(run?.id ?? `run-${index}`);
      const runRisk = Number(run?.riskScore ?? run?.score ?? run?.overallRisk ?? 0);
      const createdAt = run?.createdAt ? new Date(String(run.createdAt)).toLocaleString("pt-BR") : "Sem data";
      const tone: GovernanceStateTone = runRisk >= 75 ? "SUSPENDED" : runRisk >= 50 ? "RESTRICTED" : runRisk >= 30 ? "WARNING" : "NORMAL";

      return [
        {
          id: `${runId}-start`,
          event: "GOVERNANCE_RUN_STARTED" as const,
          title: "Governance run iniciado",
          summary: "Motor começou a consolidar sinais de timeline, risco e operação.",
          occurredAt: createdAt,
          riskScore: runRisk,
          stateLabel: tone,
          timelinePath: "/timeline?module=governance",
        },
        {
          id: `${runId}-completed`,
          event: "GOVERNANCE_RUN_COMPLETED" as const,
          title: "Governance run concluído",
          summary: `Leitura consolidada com risco ${runRisk}/100 e decisões emitidas para ação.`,
          occurredAt: createdAt,
          riskScore: runRisk,
          stateLabel: tone,
          timelinePath: "/timeline?module=governance",
        },
        {
          id: `${runId}-state-changed`,
          event: "OPERATIONAL_STATE_CHANGED" as const,
          title: "Estado operacional reavaliado",
          summary: `Operação classificada como ${tone}.`,
          occurredAt: createdAt,
          riskScore: runRisk,
          stateLabel: tone,
          timelinePath: "/timeline?module=governance&event=OPERATIONAL_STATE_CHANGED",
        },
      ];
    });

    return items.slice(0, 9);
  }, [runs]);

  const assignablePeople = useMemo(() => people.filter(person => person?.active !== false), [people]);
  const firstOverdueCharge = overdueChargesList[0] ?? null;
  const firstUnassignedServiceOrder = serviceOrders.find(
    order => !order?.assignedToPersonId && ["OPEN", "ASSIGNED"].includes(String(order?.status ?? ""))
  );

  const engineActions = useMemo<Action[]>(() => [
    {
      id: "charge.send_whatsapp",
      type: "charge",
      label: "Cobrar agora",
      description: "Envia lembrete de cobrança via WhatsApp sem sair da Governança.",
      requiresConfirmation: true,
      execute: async context => {
        await executeGovernanceAction.mutateAsync({
          id: "charge.send_whatsapp",
          type: "charge",
          label: "Cobrar agora",
          description: "Cobrança enviada via Action Engine",
          requiresConfirmation: true,
          context,
        });
      },
    },
    {
      id: "assignment.assign_owner",
      type: "assignment",
      label: "Atribuir responsável",
      description: "Atribui automaticamente a próxima O.S. sem responsável.",
      execute: async context => {
        await executeGovernanceAction.mutateAsync({
          id: "assignment.assign_owner",
          type: "assignment",
          label: "Atribuir responsável",
          description: "Atribuição automática de responsável pela Governança",
          context,
        });
      },
    },
  ], [executeGovernanceAction]);

  async function runAction(action: Action, context: ActionContext) {
    if (action.requiresConfirmation) {
      const confirmed = window.confirm(`Confirmar execução da ação crítica: ${action.label}?`);
      if (!confirmed) return;
    }

    setActionStatus(current => ({ ...current, [action.id]: { state: "loading", message: "Executando..." } }));
    try {
      await action.execute(context);
      setActionStatus(current => ({ ...current, [action.id]: { state: "success", message: "Ação executada e registrada na timeline." } }));
      void Promise.all([summaryQuery.refetch(), runsQuery.refetch(), overdueChargesQuery.refetch(), serviceOrdersQuery.refetch()]);
    } catch (error: any) {
      setActionStatus(current => ({
        ...current,
        [action.id]: { state: "error", message: error?.message ?? "Falha ao executar ação." },
      }));
    }
  }

  const pageState: OperationalState =
    summaryQuery.isLoading && !hasSummaryData
      ? "loading"
      : summaryQuery.error && !hasSummaryData
        ? "error"
        : effectiveState;

  const alertPriorities = useMemo(() => {
    const alerts = [
      {
        id: "risk-growth",
        label: "Risco crescente",
        description: latestRisk >= 40 ? `Score ${latestRisk}/100 com tendência de escalada se não houver ação.` : "Risco estável no momento.",
        action: "/timeline?module=governance",
        active: latestRisk >= 40,
      },
      {
        id: "state-change",
        label: "Mudança de estado",
        description: `Estado operacional atual: ${governanceTone}. ${toneDescription(governanceTone)}`,
        action: "/timeline?module=governance&event=OPERATIONAL_STATE_CHANGED",
        active: governanceTone !== "NORMAL",
      },
      {
        id: "auto-action",
        label: "Ações automáticas",
        description: `${actionItems.length} ação(ões) em fila de intervenção com consequência operacional visível.`,
        action: "/timeline?module=governance",
        active: actionItems.length > 0,
      },
      {
        id: "prioritized-entities",
        label: "Entidades priorizadas",
        description: `${entitiesAtRisk.length} entidade(s) sob observação ativa para evitar bloqueio sistêmico.`,
        action: "/customers?segment=needs-contact",
        active: entitiesAtRisk.length > 0,
      },
    ];

    return alerts;
  }, [actionItems.length, entitiesAtRisk.length, governanceTone, latestRisk]);

  const details = useMemo<GovernanceDetail[]>(() => {
    const problemDetails: GovernanceDetail[] = filteredProblems.map(problem => ({
      id: `detail-${problem.id}`,
      title: problem.title,
      state: (problem.priority === "critical" ? "SUSPENDED" : problem.priority === "high" ? "RESTRICTED" : "WARNING") as GovernanceStateTone,
      reason: problem.reason,
      changed: `Governança priorizou ${problem.owner} para conter impacto em ${problem.module}.`,
      possibleNext: `Se persistir, a operação pode evoluir para ${problem.priority === "critical" ? "SUSPENDED" : "RESTRICTED"}.`,
      signals: [problem.context, problem.impact, problem.origin],
      impactedEntities: [{ label: problem.owner, path: problem.actionPath }],
      relatedEvents: ["Timeline registrou evento de risco", "Risk Engine consolidou criticidade"],
      executedActions: [problem.actionLabel],
      crossLinks: [
        { label: "Cliente", path: "/customers" },
        { label: "O.S.", path: "/service-orders" },
        { label: "Financeiro", path: "/finances" },
        { label: "WhatsApp", path: "/whatsapp" },
        { label: "Timeline", path: problem.timelinePath },
      ],
    }));

    const executionDetails: GovernanceDetail[] = executions.slice(0, 3).map(item => ({
      id: `detail-${item.id}`,
      title: item.title,
      state: item.stateLabel,
      reason: item.summary,
      changed: `Execução ${item.event} reavaliou prioridade operacional.`,
      possibleNext: "Próxima execução pode elevar ou reduzir restrições conforme sinais da Timeline.",
      signals: [
        `Evento: ${item.event}`,
        `Risco consolidado: ${item.riskScore}/100`,
        `Ocorrência: ${item.occurredAt}`,
      ],
      impactedEntities: [{ label: "Operação", path: "/dashboard" }],
      relatedEvents: ["Timeline recebeu rastreabilidade da execução", "Governança emitiu recomendações"],
      executedActions: ["Leitura executiva atualizada", "Priorização operacional aplicada"],
      crossLinks: [
        { label: "Timeline", path: item.timelinePath },
        { label: "Financeiro", path: "/finances" },
        { label: "Agendamentos", path: "/appointments" },
      ],
    }));

    return [...problemDetails, ...executionDetails];
  }, [executions, filteredProblems]);

  const selectedDetail = useMemo(() => {
    if (details.length === 0) return null;
    if (!selectedDetailId) return details[0];
    return details.find(item => item.id === selectedDetailId) ?? details[0];
  }, [details, selectedDetailId]);

  usePageDiagnostics({
    page: "governance",
    isLoading: pageState === "loading" || (runsQuery.isLoading && !hasRunsData),
    hasError: pageState === "error" || Boolean(runsQuery.error && !hasRunsData),
    isEmpty: pageState === "empty",
    dataCount: detectedProblems.length,
  });

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] governance-refactor-v2-supervision");
  }, []);

  return (
    <PageWrapper
      title="Governança · supervisão e intervenção"
      subtitle="Camada visível de supervisão contínua entre Timeline, Risk Engine e ação corretiva."
    >
      <OperationalTopCard
        contextLabel="Direção de governança"
        title="Operação sob supervisão ativa"
        description="Estado operacional, interpretação de risco, execução e rastreabilidade no mesmo fluxo."
      />
    <AppPageShell className="space-y-4">
      <AppPageHeader
        title="Governança"
        description={
          <span>
            Supervisão contínua da operação: interpretação de risco, decisão e intervenção rastreável.
            <span className="ml-2 inline-flex">
              <AppStatusBadge label={`${governanceTone} · ${operationStateLabel(pageState)}`} />
            </span>
          </span>
        }
        secondaryActions={<Button variant="outline" onClick={() => navigate("/timeline?module=governance")}>Abrir Timeline</Button>}
        actions={
          <Button
            type="button"
            onClick={() => {
              void Promise.all([summaryQuery.refetch(), runsQuery.refetch()]);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar leitura
          </Button>
        }
      />

      <AppToolbar className="gap-2 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
          <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1">Período: {periodFilter}</span>
          <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1">Estado: {governanceTone}</span>
          <span className="rounded-full border border-[var(--border-subtle)] px-2 py-1">Risco: {latestRisk}/100</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={periodFilter === "24h" ? "default" : "outline"} onClick={() => setPeriodFilter("24h")}>24h</Button>
          <Button size="sm" variant={periodFilter === "7d" ? "default" : "outline"} onClick={() => setPeriodFilter("7d")}>7 dias</Button>
          <Button size="sm" variant={periodFilter === "30d" ? "default" : "outline"} onClick={() => setPeriodFilter("30d")}>30 dias</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/finances?view=charges&status=overdue")}>Investigar financeiro</Button>
        </div>
      </AppToolbar>

      {pageState === "loading" ? <AppPageLoadingState description="Carregando estado atual, ações e contexto de governança..." /> : null}
      {pageState === "error" ? (
        <AppPageErrorState
          description={summaryQuery.error?.message ?? "Falha ao carregar dados de governança."}
          actionLabel="Tentar novamente"
          onAction={() => {
            void Promise.all([summaryQuery.refetch(), runsQuery.refetch()]);
          }}
        />
      ) : null}

      {pageState !== "loading" && pageState !== "error" ? (
        <>
          <AppSectionBlock title="1) Estado atual · leitura executiva" subtitle="Saúde operacional em segundos: estado, causa, sinais e próxima ação.">
            <div className="grid gap-3 xl:grid-cols-4">
              <AppStatCard
                label="Estado operacional"
                value={governanceTone}
                helper={toneDescription(governanceTone)}
              />
              <AppStatCard
                label="Por que está assim"
                value={filteredProblems[0]?.title ?? "Sem desvio crítico"}
                helper={filteredProblems[0]?.reason ?? "Sem gatilho crítico no período."}
              />
              <AppStatCard
                label="Sinais detectados"
                value={`${filteredProblems.length} sinal(is)`}
                helper="Consolidação entre Timeline, risco e módulos operacionais."
              />
              <AppStatCard
                label="Próxima ação"
                value={actionItems[0]?.title ?? "Monitoramento ativo"}
                helper={actionItems[0]?.impact ?? "Sem intervenção pendente no momento."}
              />
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {alertPriorities.map(alert => (
                <button
                  type="button"
                  key={alert.id}
                  onClick={() => navigate(alert.action)}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 text-left transition hover:border-[var(--border-emphasis)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{alert.label}</p>
                    <AppStatusBadge label={alert.active ? "Ativo" : "Estável"} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{alert.description}</p>
                </button>
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock title="2) Ações do sistema · histórico de execução" subtitle="Governança interpreta, decide e executa. Nada de alerta passivo.">
            <div className="grid gap-3 xl:grid-cols-12">
              <div className="space-y-2 xl:col-span-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ações do sistema</p>
                <div className="grid gap-2">
                  {actionItems.length === 0 ? (
                    <AppPageEmptyState title="Sem ações pendentes" description="Quando houver risco com consequência operacional, as ações aparecerão aqui." />
                  ) : (
                    actionItems.map(item => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setSelectedDetailId(`detail-${item.id.replace("system-action-", "")}`)}
                        className="rounded-lg border border-[var(--border-subtle)] p-3 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                          <AppPriorityBadge label={item.priority} />
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.reason}</p>
                        <p className="text-xs text-[var(--text-muted)]">Impacto: {item.impact}</p>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={() => navigate(item.ctaPath)}>{item.ctaLabel}</Button>
                          <Button size="sm" variant="outline" onClick={() => navigate(item.timelinePath)}>Rastrear</Button>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Execução direta</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Button
                      disabled={!firstOverdueCharge || actionStatus["charge.send_whatsapp"]?.state === "loading"}
                      onClick={() =>
                        runAction(engineActions[0], {
                          chargeId: String(firstOverdueCharge?.id ?? ""),
                          customerId: String(firstOverdueCharge?.customerId ?? ""),
                        })
                      }
                    >
                      {actionStatus["charge.send_whatsapp"]?.state === "loading" ? "Cobrando..." : "Cobrar agora"}
                    </Button>
                    <Button
                      disabled={!firstUnassignedServiceOrder || assignablePeople.length === 0 || actionStatus["assignment.assign_owner"]?.state === "loading"}
                      onClick={() =>
                        runAction(engineActions[1], {
                          serviceOrderId: String(firstUnassignedServiceOrder?.id ?? ""),
                          assignedToPersonId: String(assignablePeople[0]?.id ?? ""),
                          expectedUpdatedAt: String(firstUnassignedServiceOrder?.updatedAt ?? ""),
                        })
                      }
                    >
                      {actionStatus["assignment.assign_owner"]?.state === "loading" ? "Atribuindo..." : "Atribuir responsável"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 xl:col-span-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Histórico de execuções</p>
                {runsQuery.isLoading && !hasRunsData ? (
                  <AppPageLoadingState description="Carregando histórico de governança..." />
                ) : runsQuery.error && !hasRunsData ? (
                  <AppPageErrorState
                    description={runsQuery.error?.message ?? "Falha ao carregar histórico de governança."}
                    actionLabel="Tentar novamente"
                    onAction={() => void runsQuery.refetch()}
                  />
                ) : executions.length === 0 ? (
                  <AppPageEmptyState title="Sem execuções registradas" description="A primeira execução vai aparecer com rastreabilidade completa aqui." />
                ) : (
                  <AppTimeline className="space-y-2">
                    {executions.map(item => (
                      <AppTimelineItem
                        key={item.id}
                        className="cursor-pointer p-2.5"
                        onClick={() => setSelectedDetailId(`detail-${item.id}`)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold text-[var(--text-primary)]">{item.event}</p>
                          <AppStatusBadge label={item.stateLabel} />
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">{item.summary}</p>
                        <p className="text-xs text-[var(--text-muted)]">{item.occurredAt}</p>
                      </AppTimelineItem>
                    ))}
                  </AppTimeline>
                )}
              </div>

              <div className="space-y-2 xl:col-span-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Políticas / regras ativas</p>
                {institutionalPolicies.length === 0 ? (
                  <AppPageEmptyState
                    title="Estrutura pronta para políticas"
                    description="Sem inventar backend: esta área já está pronta para publicar regras configuráveis na evolução da V2."
                  />
                ) : (
                  <ul className="space-y-2">
                    {institutionalPolicies.slice(0, 6).map((policy, index) => (
                      <li key={String(policy?.id ?? `policy-${index}`)} className="rounded-lg border border-[var(--border-subtle)] p-3">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{String(policy?.title ?? policy?.name ?? "Política")}</p>
                        <p className="text-xs text-[var(--text-muted)]">{String(policy?.condition ?? policy?.trigger ?? "Condição não especificada")}</p>
                        <p className="text-xs text-[var(--text-secondary)]">→ {String(policy?.action ?? policy?.resolution ?? "Ação não especificada")}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </AppSectionBlock>

          <AppSectionBlock title="3) Detalhe · contexto de governança" subtitle="O que aconteceu, por que importou, o que mudou e o que pode acontecer em seguida.">
            {!selectedDetail ? (
              <AppPageEmptyState
                title="Sem detalhe disponível"
                description="Sem contexto selecionado. Assim que houver sinal ou execução, o detalhe de governança ficará visível aqui."
              />
            ) : (
              <div className="grid gap-3 xl:grid-cols-12">
                <div className="space-y-2 xl:col-span-7">
                  <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedDetail.title}</p>
                      <AppStatusBadge label={selectedDetail.state} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedDetail.reason}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Mudança: {selectedDetail.changed}</p>
                    <p className="text-xs text-[var(--text-muted)]">Próximo possível: {selectedDetail.possibleNext}</p>
                  </div>

                  <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Cadeia de decisão</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">Evento acontece → Timeline registra → Risk Engine interpreta → Governança age.</p>
                    <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                      {selectedDetail.relatedEvents.map(event => (
                        <li key={event}>• {event}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-2 xl:col-span-5">
                  <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Sinais e ações executadas</p>
                    <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                      {selectedDetail.signals.map(signal => (
                        <li key={signal}>• {signal}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">Ações</p>
                    <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                      {selectedDetail.executedActions.map(action => (
                        <li key={action}>• {action}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Entidades impactadas e links cruzados</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedDetail.impactedEntities.map(entity => (
                        <Button key={entity.label} size="sm" variant="outline" onClick={() => navigate(entity.path)}>{entity.label}</Button>
                      ))}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedDetail.crossLinks.map(link => (
                        <Button key={link.label} size="sm" variant="outline" onClick={() => navigate(link.path)}>
                          {link.label}
                          <ArrowUpRight className="ml-2 h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </AppSectionBlock>

          {recommendations.length > 0 ? (
            <AppSectionBlock title="Recomendações do motor" subtitle="Leitura complementar para intervenção assistida.">
              <ul className="grid gap-2 sm:grid-cols-2">
                {recommendations.slice(0, 4).map((item, index) => (
                  <li key={String(item?.id ?? `recommendation-${index}`)} className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{String(item?.title ?? item?.action ?? "Ação recomendada")}</p>
                    <p className="text-xs text-[var(--text-muted)]">{String(item?.description ?? item?.impact ?? "Sem descrição detalhada")}</p>
                  </li>
                ))}
              </ul>
            </AppSectionBlock>
          ) : null}

          {failures.length > 0 ? (
            <AppSectionBlock title="Falhas abertas de execução" subtitle="Pontos que ainda exigem intervenção para fechamento de ciclo.">
              <ul className="space-y-2">
                {failures.slice(0, 6).map((failure, index) => (
                  <li key={String(failure?.id ?? `failure-${index}`)} className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{String(failure?.title ?? "Falha operacional")}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{String(failure?.description ?? "Sem detalhe complementar")}</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/timeline?severity=critical")}>Resolver agora</Button>
                  </li>
                ))}
              </ul>
            </AppSectionBlock>
          ) : null}

          {pageState === "empty" ? (
            <div className="space-y-2">
              <AppPageEmptyState
                title="Sem eventos críticos no período"
                description="Operação saudável nesta janela. Use os atalhos da barra de contexto para auditar Timeline e módulos-chave."
              />
              <div className="flex justify-center">
                <Button onClick={() => navigate("/timeline?module=governance")}>Auditar Timeline</Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </AppPageShell>
    </PageWrapper>
  );
}
