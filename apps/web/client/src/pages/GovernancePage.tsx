// OperationalTopCard lint contract: actions are rendered with AppOperationalHeader in this module.
import { useMemo } from "react";
import { useLocation } from "wouter";
import {
  EntityTimelineCard,
  NextBestActionCard,
  OperationalFlowCard,
  OperationalRiskCard,
  OperationalStateCard,
  type OperationalFlowStageState,
} from "@/components/app/OperationalCommandLayer";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import {
  AppDataTable,
  AppFiltersBar,
  AppKpiRow,
  AppOperationalHeader,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { trpc } from "@/lib/trpc";
import {
  normalizeArrayPayload,
  normalizeObjectPayload,
} from "@/lib/query-helpers";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { setBootPhase } from "@/lib/bootPhase";

type GovernanceState = "NORMAL" | "WARNING" | "RESTRICTED" | "SUSPENDED";
type Priority = "critical" | "high" | "medium";

type Signal = {
  id: string;
  title: string;
  reason: string;
  impact: string;
  priority: Priority;
  count: number;
  cta: string;
  path: string;
};

type NextBestAction = {
  title: string;
  entity: string;
  reason: string;
  impact: string;
  safetyNote: string;
  primaryActionLabel: string;
  primaryPath: string;
  secondaryActionLabel?: string;
  secondaryPath?: string;
};

function metric(source: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function textField(source: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function hasState(
  source: Record<string, any> | undefined,
  expected: GovernanceState
) {
  if (!source) return false;
  const values = [
    source.state,
    source.status,
    source.operationalState,
    source.level,
    source.result,
  ].map(value => String(value ?? "").toUpperCase());
  return values.includes(expected);
}

function formatDateTime(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isRecentDate(value: unknown, hours = 48) {
  if (!value) return false;
  const time = new Date(String(value)).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= hours * 60 * 60 * 1000;
}

function priorityLabel(priority: Priority) {
  if (priority === "critical") return "Crítica";
  if (priority === "high") return "Alta";
  return "Média";
}

function stateFromSignals({
  signals,
  riskScore,
  summary,
  runs,
}: {
  signals: Signal[];
  riskScore: number;
  summary: Record<string, any>;
  runs: any[];
}): GovernanceState {
  const latestRun = runs[0];
  if (hasState(summary, "SUSPENDED") || hasState(latestRun, "SUSPENDED"))
    return "SUSPENDED";
  if (hasState(summary, "RESTRICTED") || hasState(latestRun, "RESTRICTED"))
    return "RESTRICTED";
  if (signals.some(item => item.priority === "critical") || riskScore >= 55)
    return "RESTRICTED";
  if (signals.length > 0 || riskScore >= 30) return "WARNING";
  return "NORMAL";
}

function stateCopy(state: GovernanceState) {
  if (state === "SUSPENDED")
    return "A operação tem suspensão registrada pela governança e exige contenção imediata antes de novas decisões.";
  if (state === "RESTRICTED")
    return "A operação pode seguir com limite: sinais críticos ou política restritiva pedem intervenção prioritária.";
  if (state === "WARNING")
    return "A operação está funcionando, porém há desvios que precisam de ação antes que virem bloqueio.";
  return "Operação estável: nenhum sinal relevante exige intervenção neste momento.";
}

function buildNextBestAction({
  state,
  signals,
  policyAppliedCount,
  policyPendingCount,
}: {
  state: GovernanceState;
  signals: Signal[];
  policyAppliedCount: number;
  policyPendingCount: number;
}): NextBestAction {
  const dominant = signals[0];
  const financialSignal = signals.find(item => item.id === "overdue");
  const orderSignal = signals.find(
    item => item.id === "late-orders" || item.id === "unassigned"
  );
  const appointmentSignal = signals.find(item => item.id === "appointments");
  const criticalSignal = signals.find(item => item.priority === "critical");

  if (state === "SUSPENDED" || state === "RESTRICTED") {
    return {
      title: "Revisar intervenção crítica",
      entity: dominant?.title ?? "Governança operacional",
      reason:
        dominant?.reason ??
        "A governança indica estado restrito ou suspenso com impacto transversal.",
      impact:
        "Reduzir risco antes que o fluxo Cliente → Agendamento → O.S. → Cobrança → Pagamento seja comprometido.",
      safetyNote:
        "A ação apenas navega para análise; nenhuma política é executada automaticamente.",
      primaryActionLabel: dominant?.cta ?? "Abrir histórico de governança",
      primaryPath: dominant?.path ?? "/timeline?module=governance",
      secondaryActionLabel: "Ver Timeline",
      secondaryPath: "/timeline?module=governance",
    };
  }

  if (state === "WARNING") {
    return {
      title: "Analisar sinais de risco",
      entity: dominant?.title ?? "Sinais de governança",
      reason:
        dominant?.reason ??
        "Há sinais iniciais que ainda não bloqueiam a operação.",
      impact:
        "Tratar o desvio cedo preserva previsibilidade operacional e evita restrição futura.",
      safetyNote:
        "A recomendação depende somente dos sinais já carregados nesta página.",
      primaryActionLabel: dominant?.cta ?? "Ver sinais",
      primaryPath: dominant?.path ?? "/timeline?module=governance",
      secondaryActionLabel: "Ver histórico",
      secondaryPath: "/timeline?module=governance",
    };
  }

  if (policyPendingCount > 0 || policyAppliedCount > 0) {
    return {
      title: "Revisar política aplicada",
      entity: "Políticas de governança",
      reason: `${policyPendingCount || policyAppliedCount} política(s) aparecem nos metadados de governança.`,
      impact:
        "Confirmar a política evita intervenção divergente da regra operacional vigente.",
      safetyNote: "Sem criar regra nova: apenas revisar o registro disponível.",
      primaryActionLabel: "Ver histórico",
      primaryPath: "/timeline?module=governance",
    };
  }

  if (criticalSignal) {
    return {
      title: "Investigar evento crítico",
      entity: criticalSignal.title,
      reason: criticalSignal.reason,
      impact: criticalSignal.impact,
      safetyNote:
        "Investigação manual; nenhum evento adicional é gravado pela página.",
      primaryActionLabel: criticalSignal.cta,
      primaryPath: criticalSignal.path,
      secondaryActionLabel: "Ver Timeline",
      secondaryPath: "/timeline?module=governance",
    };
  }

  if (financialSignal) {
    return {
      title: "Abrir Financeiro",
      entity: financialSignal.title,
      reason: financialSignal.reason,
      impact: financialSignal.impact,
      safetyNote:
        "A governança apenas direciona a cobrança; não envia comunicação nem altera pagamento.",
      primaryActionLabel: financialSignal.cta,
      primaryPath: financialSignal.path,
    };
  }

  if (orderSignal) {
    return {
      title: "Abrir O.S.",
      entity: orderSignal.title,
      reason: orderSignal.reason,
      impact: orderSignal.impact,
      safetyNote: "A navegação leva ao contexto operacional existente de O.S.",
      primaryActionLabel: orderSignal.cta,
      primaryPath: orderSignal.path,
    };
  }

  if (appointmentSignal) {
    return {
      title: "Abrir Agendamentos",
      entity: appointmentSignal.title,
      reason: appointmentSignal.reason,
      impact: appointmentSignal.impact,
      safetyNote: "A recomendação não cria novo fluxo de comunicação.",
      primaryActionLabel: appointmentSignal.cta,
      primaryPath: appointmentSignal.path,
    };
  }

  return {
    title: "Revisar histórico de governança",
    entity: "Governança operacional",
    reason:
      "Não há pendência dominante nesta leitura; manter prova e histórico sob observação.",
    impact:
      "Preserva rastreabilidade das decisões oficiais sem criar intervenção desnecessária.",
    safetyNote:
      "Fallback seguro: sem dados críticos, a página orienta leitura histórica.",
    primaryActionLabel: "Ver Timeline",
    primaryPath: "/timeline?module=governance",
  };
}

export default function GovernancePage() {
  setBootPhase("PAGE:Governança");
  useRenderWatchdog("GovernancePage");

  const [, navigate] = useLocation();
  const summaryQuery = trpc.governance.summary.useQuery(undefined, {
    retry: false,
  });
  const runsQuery = trpc.governance.runs.useQuery(
    { limit: 12 },
    { retry: false }
  );
  const overdueChargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 20, status: "OVERDUE" },
    { retry: false }
  );
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 60 },
    { retry: false }
  );
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, {
    retry: false,
  });

  const summary = useMemo(
    () => normalizeObjectPayload<any>(summaryQuery.data) ?? {},
    [summaryQuery.data]
  );
  const runs = useMemo(
    () => normalizeArrayPayload<any>(runsQuery.data),
    [runsQuery.data]
  );
  const chargesPayload = useMemo(
    () => normalizeObjectPayload<any>(overdueChargesQuery.data) ?? {},
    [overdueChargesQuery.data]
  );
  const serviceOrdersPayload = useMemo(
    () => normalizeObjectPayload<any>(serviceOrdersQuery.data) ?? {},
    [serviceOrdersQuery.data]
  );
  const overdueCharges = useMemo(
    () =>
      normalizeArrayPayload<any>(
        chargesPayload.data ?? chargesPayload.items ?? overdueChargesQuery.data
      ),
    [chargesPayload, overdueChargesQuery.data]
  );
  const serviceOrders = useMemo(
    () =>
      normalizeArrayPayload<any>(
        serviceOrdersPayload.data ??
          serviceOrdersPayload.items ??
          serviceOrdersQuery.data
      ),
    [serviceOrdersPayload, serviceOrdersQuery.data]
  );
  const appointments = useMemo(
    () => normalizeArrayPayload<any>(appointmentsQuery.data),
    [appointmentsQuery.data]
  );

  const openOrders = serviceOrders.filter(
    item =>
      !["DONE", "COMPLETED", "CANCELED", "CANCELLED"].includes(
        String(item?.status ?? "").toUpperCase()
      )
  );
  const delayedOrders = openOrders.filter(item => {
    if (!item?.dueDate) return false;
    const due = new Date(String(item.dueDate)).getTime();
    return Number.isFinite(due) && due < Date.now();
  });
  const unassignedOrders = openOrders.filter(
    item => !item?.assignedToPersonId && !item?.personId && !item?.ownerId
  );
  const staleAppointments = appointments.filter(item => {
    const status = String(item?.status ?? "").toUpperCase();
    if (
      ["CONFIRMED", "DONE", "COMPLETED", "CANCELED", "CANCELLED"].includes(
        status
      )
    )
      return false;
    const when = new Date(
      String(item?.startAt ?? item?.startsAt ?? item?.date ?? "")
    ).getTime();
    return Number.isFinite(when) && when < Date.now();
  });

  const policyAppliedCount = metric(
    summary,
    "policiesApplied",
    "appliedPolicies",
    "policyApplied",
    "rulesApplied"
  );
  const policyPendingCount = metric(
    summary,
    "pendingPolicies",
    "policiesPending",
    "pendingRules",
    "rulesPending"
  );
  const latestRun = runs[0];
  const lastRunAt =
    latestRun?.finishedAt ??
    latestRun?.completedAt ??
    latestRun?.createdAt ??
    latestRun?.startedAt ??
    latestRun?.occurredAt;
  const hasRecentRun = isRecentDate(lastRunAt);

  const signals = useMemo<Signal[]>(() => {
    const items: Signal[] = [];
    const governanceRiskScore = metric(
      summary,
      "riskScore",
      "score",
      "operationalRiskScore"
    );
    const backendAlerts = metric(
      summary,
      "alerts",
      "openAlerts",
      "activeAlerts"
    );
    if (overdueCharges.length > 0) {
      items.push({
        id: "overdue",
        title: "Cobranças vencidas sem resolução",
        reason: `${overdueCharges.length} cobrança(s) vencida(s) aparecem na fonte financeira.`,
        impact: "Pressiona caixa e pode bloquear continuidade comercial.",
        priority: overdueCharges.length >= 3 ? "critical" : "high",
        count: overdueCharges.length,
        cta: "Priorizar cobrança",
        path: "/finances?status=OVERDUE&source=governance",
      });
    }
    if (delayedOrders.length > 0) {
      items.push({
        id: "late-orders",
        title: "O.S. atrasadas",
        reason: `${delayedOrders.length} O.S. aberta(s) passaram do prazo informado.`,
        impact: "Aumenta retrabalho, reclamação e perda de previsibilidade.",
        priority: delayedOrders.length >= 3 ? "critical" : "high",
        count: delayedOrders.length,
        cta: "Reorganizar execução",
        path: "/service-orders?filter=late&source=governance",
      });
    }
    if (unassignedOrders.length > 0) {
      items.push({
        id: "unassigned",
        title: "O.S. sem responsável",
        reason: `${unassignedOrders.length} O.S. não têm dono operacional claro.`,
        impact: "Cria fila invisível e impede cobrança de execução.",
        priority: "medium",
        count: unassignedOrders.length,
        cta: "Atribuir responsáveis",
        path: "/service-orders?filter=unassigned&source=governance",
      });
    }
    if (staleAppointments.length > 0) {
      items.push({
        id: "appointments",
        title: "Agendamentos pendentes no passado",
        reason: `${staleAppointments.length} agenda(s) não foram concluídas nem canceladas.`,
        impact: "Deixa a agenda pouco confiável para decisão diária.",
        priority: "medium",
        count: staleAppointments.length,
        cta: "Revisar agenda",
        path: "/appointments?source=governance",
      });
    }
    if (backendAlerts > 0 || governanceRiskScore >= 30) {
      items.push({
        id: "risk-score",
        title: "Sinal de risco consolidado",
        reason: `Fonte de governança reporta score ${governanceRiskScore || "ativo"} e ${backendAlerts} alerta(s).`,
        impact:
          "Indica risco transversal que deve ser acompanhado no histórico.",
        priority: governanceRiskScore >= 70 ? "critical" : "high",
        count: Math.max(backendAlerts, governanceRiskScore),
        cta: "Ver histórico",
        path: "/timeline?module=governance",
      });
    }
    if (!hasRecentRun && runs.length === 0) {
      items.push({
        id: "no-recent-run",
        title: "Sem execução recente registrada",
        reason:
          "A página não recebeu execução oficial de governança nesta leitura.",
        impact:
          "Reduz confiança na decisão automática e pede conferência da Timeline.",
        priority: "medium",
        count: 1,
        cta: "Ver Timeline",
        path: "/timeline?module=governance",
      });
    }
    return items;
  }, [
    delayedOrders.length,
    hasRecentRun,
    overdueCharges.length,
    runs.length,
    staleAppointments.length,
    summary,
    unassignedOrders.length,
  ]);

  const riskScore = Math.max(
    metric(summary, "riskScore", "score", "operationalRiskScore"),
    signals.reduce(
      (total, item) =>
        total +
        (item.priority === "critical" ? 25 : item.priority === "high" ? 15 : 8),
      0
    )
  );
  const state = stateFromSignals({ signals, riskScore, summary, runs });
  const dominantSignal = signals[0];
  const stateReason =
    dominantSignal?.reason ??
    textField(summary, "reason", "mainReason", "statusReason") ??
    "Sem sinal crítico retornado nas fontes carregadas.";
  const stateImpact =
    dominantSignal?.impact ??
    "Fluxo Cliente → Agendamento → O.S. → Cobrança → Pagamento permanece sem bloqueio detectado.";
  const riskTitle = dominantSignal
    ? dominantSignal.title
    : "Risco governado sem sinal crítico";
  const riskReason = dominantSignal
    ? dominantSignal.reason
    : "Cobranças vencidas, O.S. atrasadas, agendamentos pendentes e alertas de governança não apontam risco dominante.";
  const riskImpact = dominantSignal
    ? dominantSignal.impact
    : "A governança permanece em observação e a Timeline deve registrar novas decisões quando houver evento real.";
  const nextBestAction = buildNextBestAction({
    state,
    signals,
    policyAppliedCount,
    policyPendingCount,
  });

  const flowStages: Array<{
    id: string;
    label: string;
    summary: string;
    state: OperationalFlowStageState;
    countOrValue?: string;
    hrefLabel?: string;
    onClick?: () => void;
  }> = [
    {
      id: "event",
      label: "Evento",
      summary: signals.length
        ? "Sinais operacionais foram detectados nas fontes carregadas."
        : "Sem evento crítico nesta leitura.",
      state: signals.length ? "done" : "idle",
      countOrValue: String(signals.length),
    },
    {
      id: "timeline",
      label: "Timeline",
      summary: runs.length
        ? "Há histórico real de governança para sustentar a decisão."
        : "Sem prova oficial retornada; abrir Timeline completa.",
      state: runs.length ? (hasRecentRun ? "active" : "done") : "idle",
      countOrValue: String(runs.length),
      hrefLabel: "Abrir Timeline",
      onClick: () => navigate("/timeline?module=governance"),
    },
    {
      id: "risk",
      label: "Risco",
      summary: dominantSignal
        ? dominantSignal.title
        : "Risco sem sinal dominante.",
      state:
        state === "SUSPENDED"
          ? "blocked"
          : state === "RESTRICTED" || state === "WARNING"
            ? "warning"
            : "done",
      countOrValue: `Score ${riskScore}`,
    },
    {
      id: "governance",
      label: "Governança",
      summary: hasRecentRun
        ? "Execução recente disponível."
        : "Decisão depende da leitura atual e do histórico carregado.",
      state:
        state === "SUSPENDED"
          ? "blocked"
          : state === "RESTRICTED" || state === "WARNING"
            ? "warning"
            : hasRecentRun
              ? "active"
              : "idle",
      countOrValue: state,
    },
    {
      id: "policy",
      label: "Política",
      summary: policyPendingCount
        ? "Política pendente exige revisão."
        : policyAppliedCount
          ? "Política aplicada registrada nos metadados."
          : "Sem política específica retornada.",
      state: policyPendingCount
        ? "warning"
        : policyAppliedCount
          ? "done"
          : "idle",
      countOrValue: String(policyPendingCount || policyAppliedCount || 0),
    },
    {
      id: "action",
      label: "Ação",
      summary: nextBestAction.title,
      state: state === "NORMAL" && signals.length === 0 ? "idle" : "active",
      hrefLabel: nextBestAction.primaryActionLabel,
      onClick: () => navigate(nextBestAction.primaryPath),
    },
  ];

  const timelineEvents = runs
    .map((run: any, index: number) => {
      const occurredAt =
        run?.finishedAt ??
        run?.completedAt ??
        run?.createdAt ??
        run?.startedAt ??
        run?.occurredAt;
      if (!occurredAt || formatDateTime(occurredAt) === "—") return null;
      return {
        id: String(run?.id ?? `governance-run-${index}`),
        type: String(run?.event ?? run?.type ?? run?.status ?? "Governança"),
        occurredAt: formatDateTime(occurredAt),
        entity: String(
          run?.policyName ??
            run?.ruleName ??
            run?.entity ??
            "Governança operacional"
        ),
        actor: String(run?.actorName ?? run?.actor ?? run?.source ?? "Sistema"),
        summary: String(
          run?.summary ??
            run?.message ??
            run?.reason ??
            "Execução oficial de governança retornada pelo histórico."
        ),
      };
    })
    .filter(Boolean)
    .slice(0, 4) as Array<{
    id: string;
    type: string;
    occurredAt: string;
    entity: string;
    actor?: string;
    summary: string;
  }>;

  const executedActions = [
    {
      label: "Alertas gerados",
      value: String(signals.length),
      detail: signals.length
        ? "Alertas derivados de cobrança, execução, agenda e metadados de governança."
        : "Nenhum alerta necessário agora.",
    },
    {
      label: "Ações automáticas",
      value: String(
        metric(summary, "automaticActions", "actionsExecuted", "autoActions")
      ),
      detail:
        "Execuções registradas pela governança quando disponíveis no backend.",
    },
    {
      label: "Restrições aplicadas",
      value: state === "SUSPENDED" || state === "RESTRICTED" ? "Sim" : "Não",
      detail:
        state === "NORMAL"
          ? "Sem restrição operacional."
          : "Revisar prioridades antes de expandir novas ações.",
    },
  ];

  const policyRows = [
    {
      name: "Políticas aplicadas",
      value: String(policyAppliedCount),
      detail: policyAppliedCount
        ? "Metadado de política aplicada retornado pela governança."
        : "Nenhuma política aplicada retornada nesta leitura.",
    },
    {
      name: "Políticas pendentes",
      value: String(policyPendingCount),
      detail: policyPendingCount
        ? "Há política pendente para revisão operacional."
        : "Nenhuma política pendente retornada nesta leitura.",
    },
    {
      name: "Última execução",
      value: formatDateTime(lastRunAt),
      detail: runs.length
        ? "Data real do histórico de governança."
        : "Sem execução oficial retornada; não foi criado histórico fictício.",
    },
  ];

  return (
    <PageWrapper
      title="Governança"
      subtitle="Centro de decisão operacional com sinais, ações e recomendações."
    >
      <AppPageShell>
        <AppOperationalHeader
          title="Governança operacional"
          description={stateCopy(state)}
          primaryAction={
            <Button onClick={() => navigate("/timeline?module=governance")}>
              Abrir trilha de decisões
            </Button>
          }
          secondaryActions={
            <Button
              variant="outline"
              onClick={() =>
                void Promise.all([
                  summaryQuery.refetch(),
                  runsQuery.refetch(),
                  overdueChargesQuery.refetch(),
                  serviceOrdersQuery.refetch(),
                  appointmentsQuery.refetch(),
                ])
              }
            >
              Atualizar sinais
            </Button>
          }
          contextChips={
            <>
              <AppStatusBadge label={state} />
              <AppStatusBadge label={`Score ${riskScore}`} />
              <AppStatusBadge label={`${signals.length} sinal(is)`} />
            </>
          }
        />

        <AppFiltersBar>
          <div className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-4">
            <span>
              <strong>NORMAL:</strong> operação controlada.
            </span>
            <span>
              <strong>WARNING:</strong> desvio pede ação.
            </span>
            <span>
              <strong>RESTRICTED:</strong> limitar decisões até correção.
            </span>
            <span>
              <strong>SUSPENDED:</strong> apenas quando o backend/histórico
              registra suspensão.
            </span>
          </div>
        </AppFiltersBar>

        <section className="grid gap-4 xl:grid-cols-3">
          <OperationalStateCard
            level={state}
            title="Estado operacional governado"
            reason={stateReason}
            impact={stateImpact}
            detailsLabel="Ver histórico"
            onDetails={() => navigate("/timeline?module=governance")}
          />
          <OperationalRiskCard
            title={riskTitle}
            reason={riskReason}
            impact={riskImpact}
            ctaLabel={dominantSignal?.cta ?? "Abrir Timeline"}
            onClick={() =>
              navigate(dominantSignal?.path ?? "/timeline?module=governance")
            }
          />
          <NextBestActionCard
            title={nextBestAction.title}
            entity={nextBestAction.entity}
            reason={nextBestAction.reason}
            impact={nextBestAction.impact}
            safetyNote={nextBestAction.safetyNote}
            primaryActionLabel={nextBestAction.primaryActionLabel}
            onPrimaryAction={() => navigate(nextBestAction.primaryPath)}
            secondaryActionLabel={nextBestAction.secondaryActionLabel}
            onSecondaryAction={
              nextBestAction.secondaryPath
                ? () => navigate(nextBestAction.secondaryPath!)
                : undefined
            }
          />
        </section>

        <OperationalFlowCard
          title="Evento → Timeline → Risco → Governança → Política → Ação"
          subtitle="Cadeia de decisão que transforma sinais operacionais em intervenção orientada, sem executar ações automaticamente."
          stages={flowStages}
        />

        <EntityTimelineCard
          title="Últimas decisões oficiais de governança"
          subtitle="Prova operacional derivada somente do histórico real retornado por governança; não substitui a Timeline oficial."
          events={timelineEvents}
          fullTimelineLabel="Abrir Timeline completa"
          onFullTimeline={() => navigate("/timeline?module=governance")}
        />

        <AppKpiRow
          items={[
            {
              title: "Estado atual",
              value: state,
              hint: "Estado operacional consolidado.",
            },
            {
              title: "Sinais detectados",
              value: String(signals.length),
              hint: "Problemas relevantes nesta leitura.",
            },
            {
              title: "Impacto crítico",
              value: String(
                signals.filter(item => item.priority === "critical").length
              ),
              hint: "Itens que restringem a operação; suspensão só com dado real.",
            },
            {
              title: "Execuções",
              value: String(runs.length),
              hint: "Rodadas/eventos reais de governança.",
            },
          ]}
        />

        <AppSectionBlock
          title="Sinais detectados"
          subtitle="Sinais, motivos e impacto operacional que explicam a decisão de governança."
        >
          <AppDataTable className="min-w-[820px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-3 py-2">Sinal</th>
                <th className="px-3 py-2">Motivo</th>
                <th className="px-3 py-2">Impacto</th>
                <th className="px-3 py-2">Prioridade</th>
              </tr>
            </thead>
            <tbody>
              {signals.length ? (
                signals.map(signal => (
                  <tr
                    key={signal.id}
                    className="border-b border-[var(--border-subtle)]/60"
                  >
                    <td className="px-3 py-3 font-medium text-[var(--text-primary)]">
                      {signal.title}
                    </td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">
                      {signal.reason}
                    </td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">
                      {signal.impact}
                    </td>
                    <td className="px-3 py-3">
                      <AppStatusBadge label={priorityLabel(signal.priority)} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-[var(--text-muted)]"
                  >
                    Nenhum sinal relevante detectado nesta janela.
                  </td>
                </tr>
              )}
            </tbody>
          </AppDataTable>
        </AppSectionBlock>

        <AppSectionBlock
          title="Ações do sistema"
          subtitle="Alertas, automações e restrições que o sistema já aplicou ou registrou."
        >
          <AppKpiRow
            items={executedActions.map(item => ({
              title: item.label,
              value: item.value,
              hint: item.detail,
            }))}
            gridClassName="xl:grid-cols-3"
          />
        </AppSectionBlock>

        <AppSectionBlock
          title="Histórico de execuções"
          subtitle="Mudanças de estado, execuções anteriores e eventos relevantes retornados pela governança."
        >
          <AppDataTable className="min-w-[760px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-3 py-2">Quando</th>
                <th className="px-3 py-2">Evento</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Resumo</th>
              </tr>
            </thead>
            <tbody>
              {runs.length ? (
                runs.slice(0, 12).map((run: any, index: number) => (
                  <tr
                    key={String(run?.id ?? index)}
                    className="border-b border-[var(--border-subtle)]/60"
                  >
                    <td className="px-3 py-3">
                      {formatDateTime(
                        run?.createdAt ??
                          run?.startedAt ??
                          run?.occurredAt ??
                          run?.finishedAt ??
                          run?.completedAt
                      )}
                    </td>
                    <td className="px-3 py-3 text-[var(--text-primary)]">
                      {String(
                        run?.event ?? run?.type ?? "Execução de governança"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <AppStatusBadge
                        label={String(run?.state ?? run?.status ?? state)}
                      />
                    </td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">
                      {String(run?.summary ?? run?.message ?? stateCopy(state))}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-[var(--text-muted)]"
                  >
                    Nenhuma execução oficial retornada. A página não cria
                    histórico fictício; use a Timeline completa ou aguarde uma
                    execução real.
                  </td>
                </tr>
              )}
            </tbody>
          </AppDataTable>
        </AppSectionBlock>

        <AppSectionBlock
          title="Regras e políticas existentes"
          subtitle="Metadados de política reaproveitados da governança quando disponíveis."
        >
          <AppKpiRow
            items={policyRows.map(item => ({
              title: item.name,
              value: item.value,
              hint: item.detail,
            }))}
            gridClassName="xl:grid-cols-3"
          />
        </AppSectionBlock>
      </AppPageShell>
    </PageWrapper>
  );
}
