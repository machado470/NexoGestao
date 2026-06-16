// OperationalTopCard lint contract: actions are rendered with AppOperationalHeader in this module.
import { useMemo } from "react";
import { useLocation } from "wouter";
import {
  OperationalFlowCard,
  type OperationalFlowStageState,
} from "@/components/app/OperationalCommandLayer";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import {
  AppDataTable,
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

function buildPriorityActions(signals: Signal[]): NextBestAction[] {
  const order = ["overdue", "late-orders", "appointments"];
  return order
    .map(id => signals.find(signal => signal.id === id))
    .filter(Boolean)
    .slice(0, 3)
    .map(signal => {
      if (!signal) throw new Error("Invalid signal");
      if (signal.id === "overdue") {
        return {
          title: "Priorizar cobrança vencida",
          entity: signal.title,
          reason: `${signal.count} cobrança vencida sem resolução.`,
          impact: "Reduzir risco de caixa.",
          safetyNote: "CTA seguro: apenas navega para financeiro.",
          primaryActionLabel: "Abrir financeiro",
          primaryPath: signal.path,
          secondaryActionLabel: "Abrir cobrança",
          secondaryPath: signal.path,
        };
      }
      if (signal.id === "late-orders") {
        return {
          title: "Resolver O.S. atrasadas",
          entity: signal.title,
          reason: `${signal.count} O.S. passaram do prazo.`,
          impact: "Recuperar previsibilidade da execução.",
          safetyNote: "CTA seguro: apenas navega para O.S. atrasadas.",
          primaryActionLabel: "Ver O.S. atrasadas",
          primaryPath: signal.path,
        };
      }
      return {
        title: "Confirmar agendamento pendente",
        entity: signal.title,
        reason: `${signal.count} agendamento não foi concluído nem cancelado.`,
        impact: "Limpar risco da agenda.",
        safetyNote: "CTA seguro: apenas navega para agendamentos.",
        primaryActionLabel: "Abrir agendamento",
        primaryPath: signal.path,
      };
    });
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
        title:
          overdueCharges.length === 1
            ? "Cobrança vencida sem resolução"
            : "Cobranças vencidas sem resolução",
        reason: `${overdueCharges.length} cobrança vencida sem resolução.`,
        impact: "Pressiona caixa e pode bloquear continuidade comercial.",
        priority: overdueCharges.length >= 3 ? "critical" : "high",
        count: overdueCharges.length,
        cta: "Abrir cobrança",
        path: "/finances?status=OVERDUE&source=governance",
      });
    }
    if (delayedOrders.length > 0) {
      items.push({
        id: "late-orders",
        title: "O.S. atrasadas",
        reason: `${delayedOrders.length} O.S. passaram do prazo.`,
        impact: "Aumenta retrabalho, reclamação e perda de previsibilidade.",
        priority: delayedOrders.length >= 3 ? "critical" : "high",
        count: delayedOrders.length,
        cta: "Ver O.S. atrasadas",
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
        title:
          staleAppointments.length === 1
            ? "Agendamento pendente"
            : "Agendamentos pendentes",
        reason: `${staleAppointments.length} agendamento não foi concluído nem cancelado.`,
        impact: "Deixa a agenda pouco confiável para decisão diária.",
        priority: "medium",
        count: staleAppointments.length,
        cta: "Abrir agendamento",
        path: "/appointments?source=governance",
      });
    }
    if (backendAlerts > 0 || governanceRiskScore >= 30) {
      items.push({
        id: "risk-score",
        title: "Sinal de risco consolidado",
        reason: `Risco consolidado ${governanceRiskScore || "ativo"} com ${backendAlerts} alerta(s).`,
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
        reason: "Sem execução recente registrada.",
        impact:
          "Pede conferência da trilha oficial antes de expandir decisões.",
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
  const riskLevel =
    riskScore >= 55 ? "alto" : riskScore >= 30 ? "médio" : "baixo";
  const humanRiskLabel = `Risco ${riskLevel} — ${riskScore}`;
  const state = stateFromSignals({ signals, riskScore, summary, runs });
  const dominantSignal = signals[0];
  const stateReason =
    dominantSignal?.reason ??
    textField(summary, "reason", "mainReason", "statusReason") ??
    "Sem sinal crítico retornado nas fontes carregadas.";
  const stateImpact =
    signals.length > 0
      ? "Receita em risco e execução atrasada."
      : "Operação governada sem restrição.";
  const priorityActions = buildPriorityActions(signals);

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
      label: "Sinal",
      summary: signals.length
        ? "Sinais ativos nesta leitura."
        : "Sem evento crítico nesta leitura.",
      state: signals.length ? "done" : "idle",
      countOrValue: `${signals.length} ativos`,
    },
    {
      id: "evidence",
      label: "Evidência",
      summary: runs.length
        ? "Timeline disponível."
        : "Sem execução recente registrada.",
      state: runs.length ? (hasRecentRun ? "active" : "done") : "idle",
      countOrValue: runs.length
        ? "Timeline disponível"
        : "Sem execução recente",
      hrefLabel: "Abrir Timeline",
      onClick: () => navigate("/timeline?module=governance"),
    },
    {
      id: "impact",
      label: "Impacto",
      summary: dominantSignal ? dominantSignal.title : "Sem impacto dominante.",
      state:
        state === "SUSPENDED"
          ? "blocked"
          : state === "RESTRICTED" || state === "WARNING"
            ? "warning"
            : "done",
      countOrValue: humanRiskLabel,
    },
    {
      id: "decision",
      label: "Decisão",
      summary: stateReason,
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
      countOrValue:
        policyPendingCount || policyAppliedCount
          ? String(policyPendingCount || policyAppliedCount)
          : "Sem política específica",
    },
    {
      id: "action",
      label: "Ação",
      summary: priorityActions.length
        ? `${priorityActions.length} intervenções sugeridas`
        : "Nenhuma intervenção prioritária.",
      state: priorityActions.length ? "active" : "idle",
      countOrValue: priorityActions.length
        ? `${priorityActions.length} intervenções sugeridas`
        : "Sem ação crítica",
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

  return (
    <PageWrapper
      title="Governança"
      subtitle="Centro de decisão operacional com sinais, ações e recomendações."
    >
      <AppPageShell>
        <AppOperationalHeader
          title="Governança operacional"
          description="Centro de decisão da operação. Monitora risco, aplica políticas e orienta intervenção."
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
              <AppStatusBadge label={humanRiskLabel} />
              <AppStatusBadge
                label={
                  runs.length
                    ? `Última avaliação: ${formatDateTime(lastRunAt)}`
                    : "Última avaliação: sem execução recente"
                }
              />
            </>
          }
        />

        <AppSectionBlock
          title="Estado operacional"
          subtitle="Leitura imediata do controle da operação."
          compact
        >
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <AppStatusBadge label={state} />
                <AppStatusBadge label={humanRiskLabel} />
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">
                {signals.length
                  ? `${signals.length} sinais ativos`
                  : "Operação governada sem restrição."}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {stateImpact}
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Última avaliação:{" "}
                {runs.length
                  ? formatDateTime(lastRunAt)
                  : "sem execução recente"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Sinais do estado
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                {signals.length ? (
                  signals
                    .slice(0, 4)
                    .map(signal => <li key={signal.id}>• {signal.reason}</li>)
                ) : (
                  <li>Operação governada sem restrição.</li>
                )}
              </ul>
            </div>
          </div>
        </AppSectionBlock>

        <AppSectionBlock
          title="FAÇA AGORA"
          subtitle="Intervenções seguras para reduzir restrição operacional."
        >
          {priorityActions.length ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {priorityActions.map(action => (
                <div
                  key={action.title}
                  className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4"
                >
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    {action.title}
                  </h3>
                  <p className="mt-3 text-sm text-[var(--text-secondary)]">
                    <strong>Problema:</strong> {action.reason}
                  </p>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    <strong>Resultado esperado:</strong> {action.impact}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {action.safetyNote}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => navigate(action.primaryPath)}
                    >
                      {action.primaryActionLabel}
                    </Button>
                    {action.secondaryActionLabel && action.secondaryPath ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(action.secondaryPath!)}
                      >
                        {action.secondaryActionLabel}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3 text-sm text-[var(--text-secondary)]">
              Nenhuma intervenção prioritária nesta leitura.
            </div>
          )}
        </AppSectionBlock>

        <AppSectionBlock
          title="Sinais críticos"
          subtitle="Sinal | Severidade | Origem | Ação. Máximo de quatro sinais principais."
        >
          <AppDataTable className="min-w-[760px]">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="px-3 py-2">Sinal</th>
                <th className="px-3 py-2">Severidade</th>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Ação</th>
              </tr>
            </thead>
            <tbody>
              {signals.length ? (
                signals.slice(0, 4).map(signal => (
                  <tr
                    key={signal.id}
                    className="border-b border-[var(--border-subtle)]/60"
                  >
                    <td className="px-3 py-3 font-medium text-[var(--text-primary)]">
                      {signal.title}
                    </td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">
                      {priorityLabel(signal.priority)}
                    </td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">
                      {signal.id === "overdue"
                        ? "Financeiro"
                        : signal.id === "late-orders" ||
                            signal.id === "unassigned"
                          ? "Ordens de Serviço"
                          : signal.id === "appointments"
                            ? "Agendamentos"
                            : "Timeline/Governança"}
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(signal.path)}
                      >
                        {signal.cta}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-[var(--text-muted)]"
                  >
                    Nenhum sinal crítico nesta leitura.
                  </td>
                </tr>
              )}
            </tbody>
          </AppDataTable>
        </AppSectionBlock>

        <OperationalFlowCard
          title="Sinal → Evidência → Impacto → Decisão → Política → Ação"
          subtitle="Fluxo compacto da decisão; CTAs apenas navegam, sem executar ações automaticamente."
          stages={flowStages}
        />

        <AppSectionBlock
          title="Evidências oficiais"
          subtitle="Eventos e decisões retornados pela Timeline/Governança que sustentam o estado atual."
        >
          {timelineEvents.length ? (
            <AppDataTable className="min-w-[820px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <th className="px-3 py-2">Data/hora</th>
                  <th className="px-3 py-2">Módulo</th>
                  <th className="px-3 py-2">Evento humano</th>
                  <th className="px-3 py-2">Entidade</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {timelineEvents.map(event => (
                  <tr
                    key={event.id}
                    className="border-b border-[var(--border-subtle)]/60"
                  >
                    <td className="px-3 py-3">{event.occurredAt}</td>
                    <td className="px-3 py-3">Governança</td>
                    <td className="px-3 py-3 text-[var(--text-primary)]">
                      {event.summary}
                    </td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">
                      {event.entity}
                    </td>
                    <td className="px-3 py-3">
                      <AppStatusBadge label={state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </AppDataTable>
          ) : (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-3 text-sm text-[var(--text-secondary)]">
              Nenhuma decisão oficial retornada nesta leitura. Use a Timeline
              para investigar a trilha completa.
            </div>
          )}
        </AppSectionBlock>

        <AppSectionBlock
          title="Detalhes de governança"
          subtitle="O que o sistema fez, sem inferir política ou automação não retornada."
          compact
        >
          <ul className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] p-4 text-sm text-[var(--text-secondary)]">
            <li>Alerta gerado: {signals.length > 0 ? "sim" : "não"}</li>
            <li>
              Restrição aplicada:{" "}
              {state === "SUSPENDED" || state === "RESTRICTED" ? "sim" : "não"}
            </li>
            <li>
              Ação automática registrada:{" "}
              {metric(
                summary,
                "automaticActions",
                "actionsExecuted",
                "autoActions"
              ) > 0
                ? "sim"
                : "não retornada"}
            </li>
            <li>
              Política específica:{" "}
              {policyPendingCount || policyAppliedCount
                ? "retornada"
                : "não retornada"}
            </li>
          </ul>
        </AppSectionBlock>
      </AppPageShell>
    </PageWrapper>
  );
}
