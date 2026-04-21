import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppNextActionCard,
  AppOperationalBar,
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

type GovernanceView = "visao" | "problemas" | "acoes" | "historico";
type PriorityLevel = "critical" | "high" | "medium";
type OperationalState = "healthy" | "attention" | "critical" | "empty" | "loading" | "error";

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

type ActionType = "charge" | "message" | "assignment" | "schedule";
type ActionContext = Record<string, unknown>;
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
    return `Operação sob risco alto com ${problemCount} problema(s) prioritário(s) exigindo execução imediata.`;
  }
  if (state === "attention") {
    return `Operação em atenção com ${problemCount} problema(s) que podem escalar ainda hoje.`;
  }
  if (state === "healthy") {
    return "Operação saudável no momento. Governança deve manter monitoramento ativo.";
  }
  if (state === "empty") {
    return "Sem desvios detectados. Este estado vazio indica operação saudável nesta janela.";
  }
  if (state === "loading") return "Lendo sinais operacionais para decisão automática.";
  return "Não foi possível consolidar o estado operacional agora.";
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

  const [activeView, setActiveView] = useState<GovernanceView>("visao");
  const [searchValue, setSearchValue] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | PriorityLevel>("all");
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
    runs[0]?.riskScore ??
      runs[0]?.score ??
      runs[0]?.overallRisk ??
      metric(summary, "riskScore", "overallRisk", "operationalRisk")
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

    entitiesAtRisk.slice(0, 2).forEach((entity, index) => {
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
  }, [
    communicationFailures,
    entitiesAtRisk,
    overdueCharges,
    overdueServiceOrders,
    overloadedWorkload,
    unansweredCustomers,
  ]);

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

  const governanceActions = useMemo(
    () => filteredProblems.map(problem => ({
      id: `action-${problem.id}`,
      title: problem.actionLabel,
      description: `${problem.reason} Impacto esperado: ${problem.expectedImpact}`,
      severity: (problem.priority === "critical" ? "critical" : problem.priority === "high" ? "high" : "medium") as "critical" | "high" | "medium",
      path: problem.actionPath,
      timelinePath: problem.timelinePath,
      module: problem.module,
    })),
    [filteredProblems]
  );

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
      execute: async (context) => {
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
      execute: async (context) => {
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
      void Promise.all([
        summaryQuery.refetch(),
        runsQuery.refetch(),
        overdueChargesQuery.refetch(),
        serviceOrdersQuery.refetch(),
      ]);
    } catch (error: any) {
      setActionStatus(current => ({
        ...current,
        [action.id]: { state: "error", message: error?.message ?? "Falha ao executar ação." },
      }));
    }
  }

  const hasCritical = detectedProblems.some(problem => problem.priority === "critical");
  const effectiveState = operationStateFromRisk(latestRisk, hasCritical, detectedProblems.length > 0);

  const pageState: OperationalState =
    summaryQuery.isLoading && !hasSummaryData
      ? "loading"
      : summaryQuery.error && !hasSummaryData
        ? "error"
        : effectiveState;

  usePageDiagnostics({
    page: "governance",
    isLoading: pageState === "loading" || (runsQuery.isLoading && !hasRunsData),
    hasError: pageState === "error" || Boolean(runsQuery.error && !hasRunsData),
    isEmpty: pageState === "empty",
    dataCount: detectedProblems.length,
  });

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] governance-refactor-v1");
  }, []);

  return (
    <PageWrapper title="Governança · Centro de decisão" subtitle="Governança interpreta a Timeline e decide a reação operacional com execução assistida.">
      <OperationalTopCard
        contextLabel="Direção de governança"
        title="Leitura de risco e reação imediata"
        description="Estado, prioridade e execução no mesmo fluxo para agir agora."
        primaryAction={(
          <Button
            type="button"
            onClick={() => {
              void Promise.all([summaryQuery.refetch(), runsQuery.refetch()]);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar leitura
          </Button>
        )}
      />
      <AppPageShell>
      <AppPageHeader
        title="Governança · Centro de decisão"
        description={(
          <span>
            {operationSummaryCopy(pageState, detectedProblems.length)}
            <span className="ml-2 inline-flex">
              <AppStatusBadge label={operationStateLabel(pageState)} />
            </span>
          </span>
        )}
        secondaryActions={
          <Button variant="outline" onClick={() => navigate("/timeline?module=governance")}>Ver timeline</Button>
        }
      />

      <AppOperationalBar
        tabs={[
          { value: "visao", label: "Estado geral" },
          { value: "problemas", label: "Problemas" },
          { value: "acoes", label: "Ações" },
          { value: "historico", label: "Histórico" },
        ]}
        activeTab={activeView}
        onTabChange={setActiveView}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Buscar problema, contexto ou responsável"
        quickFilters={(
          <>
            <Button size="sm" variant={priorityFilter === "all" ? "default" : "outline"} onClick={() => setPriorityFilter("all")}>Todas</Button>
            <Button size="sm" variant={priorityFilter === "critical" ? "default" : "outline"} onClick={() => setPriorityFilter("critical")}>Críticas</Button>
            <Button size="sm" variant={priorityFilter === "high" ? "default" : "outline"} onClick={() => setPriorityFilter("high")}>Altas</Button>
            <Button size="sm" variant={priorityFilter === "medium" ? "default" : "outline"} onClick={() => setPriorityFilter("medium")}>Médias</Button>
          </>
        )}
      />

      {pageState === "loading" ? <AppPageLoadingState description="Carregando leitura de risco, problemas e ações de governança..." /> : null}
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
          {(activeView === "visao" || activeView === "problemas") ? (
            <AppSectionBlock
              title="Estado geral da operação"
              subtitle="Leitura instantânea de atrasos, inadimplência, comunicação e carga de trabalho"
              className="mt-3"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <AppStatusBadge label={operationStateLabel(pageState)} />
                  <span className="text-sm text-[var(--text-secondary)]">Score de risco atual: {latestRisk}/100</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">Atrasos de O.S.</p>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">{overdueServiceOrders}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">Cobranças vencidas</p>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">{overdueCharges}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">Clientes sem resposta</p>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">{unansweredCustomers}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">Falhas de comunicação</p>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">{communicationFailures}</p>
                  </div>
                </div>
              </div>
            </AppSectionBlock>
          ) : null}

          {(activeView === "visao" || activeView === "problemas") ? (
            <AppSectionBlock
              title="Problemas detectados"
              subtitle="Lista priorizada do que está errado agora"
              className="mt-3"
            >
              {filteredProblems.length === 0 ? (
                <AppPageEmptyState
                  title="Operação saudável"
                  description="Sem problemas detectados. Estado vazio indica que não há reação urgente neste momento."
                />
              ) : (
                <ul className="space-y-2">
                  {filteredProblems.map(problem => (
                    <li key={problem.id} className="rounded-lg border border-[var(--border-subtle)] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{problem.title}</p>
                        <AppPriorityBadge label={problem.priority} />
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{problem.context}</p>
                      <p className="text-xs text-[var(--text-muted)]">Impacto: {problem.impact}</p>
                      <p className="text-xs text-[var(--text-muted)]">Origem: {problem.origin}</p>
                      <p className="text-xs text-[var(--text-muted)]">Responsável: {problem.owner}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => navigate(problem.timelinePath)}>
                          Ver origem na Timeline
                        </Button>
                        <Button size="sm" onClick={() => navigate(problem.actionPath)}>
                          {problem.actionLabel}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </AppSectionBlock>
          ) : null}

          {(activeView === "visao" || activeView === "acoes") ? (
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <AppSectionBlock
                title="Ações sugeridas"
                subtitle="Decisão automatizada com motivo, impacto e execução imediata"
              >
                {governanceActions.length === 0 ? (
                  <AppPageEmptyState title="Sem ações pendentes" description="Quando surgir risco, a governança sugerirá ações executáveis aqui." />
                ) : (
                  <div className="space-y-2">
                    {governanceActions.slice(0, 6).map(action => (
                      <AppNextActionCard
                        key={action.id}
                        title={action.title}
                        description={action.description}
                        severity={action.severity}
                        metadata={action.module}
                        action={{ label: "Executar agora", onClick: () => navigate(action.path) }}
                      />
                    ))}
                  </div>
                )}
              </AppSectionBlock>

              <AppSectionBlock
                title="Execução direta"
                subtitle="Ações assistidas sem sair do fluxo de governança"
              >
                <div className="grid gap-2 sm:grid-cols-2">
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
                  <Button variant="outline" disabled>Abrir O.S. (em breve)</Button>
                  <Button variant="outline" disabled>Enviar mensagem padrão (em breve)</Button>
                  <Button variant="outline" disabled>Remarcar agenda (em breve)</Button>
                  <Button onClick={() => navigate("/timeline?module=governance")} variant="outline">Abrir Timeline</Button>
                </div>
                <div className="mt-3 space-y-1 text-xs">
                  {engineActions.map(action => {
                    const status = actionStatus[action.id];
                    if (!status || status.state === "idle") return null;
                    const color =
                      status.state === "success"
                        ? "text-emerald-400"
                        : status.state === "error"
                          ? "text-rose-400"
                          : "text-amber-300";
                    return (
                      <p key={`${action.id}-status`} className={color}>
                        {action.label}: {status.message}
                      </p>
                    );
                  })}
                  {!firstOverdueCharge ? <p className="text-[var(--text-muted)]">Sem cobrança vencida com contexto completo para execução direta.</p> : null}
                  {!firstUnassignedServiceOrder ? <p className="text-[var(--text-muted)]">Sem O.S. aberta sem responsável para atribuição automática.</p> : null}
                </div>
              </AppSectionBlock>
            </div>
          ) : null}

          {(activeView === "visao" || activeView === "historico") ? (
            <div className="mt-3 grid gap-3 xl:grid-cols-12">
              <AppSectionBlock
                title="Histórico de governança"
                subtitle="Decisões e execuções recentes conectadas com a Timeline"
                className="xl:col-span-8"
              >
                {runsQuery.isLoading && !hasRunsData ? (
                  <AppPageLoadingState description="Carregando execuções de governança..." />
                ) : runsQuery.error && !hasRunsData ? (
                  <AppPageErrorState
                    description={runsQuery.error?.message ?? "Falha ao carregar execuções de governança."}
                    actionLabel="Tentar novamente"
                    onAction={() => void runsQuery.refetch()}
                  />
                ) : runs.length === 0 ? (
                  <AppPageEmptyState title="Sem execuções registradas" description="Assim que a governança rodar, as decisões aparecerão aqui." />
                ) : (
                  <ul className="space-y-2">
                    {runs.slice(0, 8).map((run, index) => {
                      const runRisk = Number(run?.riskScore ?? run?.score ?? run?.overallRisk ?? 0);
                      const runDate = run?.createdAt ? new Date(String(run.createdAt)).toLocaleString("pt-BR") : "Sem data";
                      return (
                        <li key={String(run?.id ?? `run-${index}`)} className="rounded-lg border border-[var(--border-subtle)] p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--text-primary)]">Execução {index + 1}</p>
                            <AppStatusBadge label={runRisk >= 70 ? "Crítico" : runRisk >= 40 ? "Atenção" : "Saudável"} />
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">Risco calculado: {runRisk}/100 · {runDate}</p>
                          <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate("/timeline?module=governance")}>Ver decisão na Timeline</Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </AppSectionBlock>

              <AppSectionBlock
                title="Regras de governança"
                subtitle="Condição → ação em linguagem simples"
                className="xl:col-span-4"
              >
                {institutionalPolicies.length === 0 ? (
                  <AppPageEmptyState
                    title="Sem regras configuradas"
                    description="Quando houver políticas publicadas, elas aparecerão como condição e ação nesta seção."
                  />
                ) : (
                  <ul className="space-y-2">
                    {institutionalPolicies.slice(0, 6).map((policy, index) => (
                      <li key={String(policy?.id ?? `policy-${index}`)} className="rounded-lg border border-[var(--border-subtle)] p-3">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{String(policy?.title ?? policy?.name ?? "Regra")}</p>
                        <p className="text-xs text-[var(--text-muted)]">{String(policy?.condition ?? policy?.trigger ?? "Condição não especificada")}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          → {String(policy?.action ?? policy?.resolution ?? policy?.status ?? "Ação não especificada")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </AppSectionBlock>
            </div>
          ) : null}

          {(activeView === "visao" || activeView === "acoes") && recommendations.length > 0 ? (
            <AppSectionBlock
              title="Sugestões automáticas do motor"
              subtitle="Ações complementares trazidas pelo backend de governança"
              className="mt-3"
            >
              <ul className="space-y-2">
                {recommendations.slice(0, 5).map((item, index) => (
                  <li key={String(item?.id ?? `recommendation-${index}`)} className="rounded-lg border border-[var(--border-subtle)] p-3">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{String(item?.title ?? item?.action ?? "Ação recomendada")}</p>
                    <p className="text-xs text-[var(--text-muted)]">{String(item?.description ?? item?.impact ?? "Sem descrição detalhada")}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => navigate("/timeline?module=governance")}
                    >
                      Rastrear na Timeline
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </AppSectionBlock>
          ) : null}

          {(activeView === "visao" || activeView === "acoes") ? (
            <AppSectionBlock
              title="Próximas ações do Action Engine"
              subtitle="Backlog planejado para ampliar execução automática ou semi-automática"
              className="mt-3"
            >
              <ul className="grid gap-2 sm:grid-cols-2">
                <li className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Reenviar cobrança automaticamente por regra de atraso.</li>
                <li className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Registrar follow-up comercial com SLA por cliente.</li>
                <li className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Enviar mensagem padrão contextual por canal.</li>
                <li className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Abrir O.S. automática a partir de falha crítica detectada.</li>
                <li className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Marcar prioridade operacional por risco e capacidade.</li>
                <li className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm">Sugerir/remarcar horário com base em capacidade da agenda.</li>
              </ul>
            </AppSectionBlock>
          ) : null}

          {failures.length > 0 && (activeView === "visao" || activeView === "problemas") ? (
            <AppSectionBlock
              title="Falhas abertas de execução"
              subtitle="Desvios operacionais ainda sem resolução"
              className="mt-3"
            >
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
        </>
      ) : null}
      </AppPageShell>
    </PageWrapper>
  );
}
