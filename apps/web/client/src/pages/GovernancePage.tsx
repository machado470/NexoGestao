import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/design-system";
import {
  AppEmptyState,
  AppPageHeader,
  AppPageShell,
  AppSectionCard,
  AppStatusBadge,
  AppTimeline,
  AppTimelineItem,
} from "@/components/app-system";
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
  source: string;
};

type NextBestAction = {
  problem: string;
  consequence: string;
  recommendation: string;
  primaryActionLabel: string;
  primaryPath: string;
};

type OfficialEvidence = {
  id: string;
  event: string;
  source: string;
  occurredAt: string;
  impact: string;
};

type GovernanceHistoryItem = {
  id: string;
  previousState: string;
  currentState: string;
  reason: string;
  occurredAt: string;
};

function metric(source: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function textField(source: Record<string, any> | undefined, ...keys: string[]) {
  if (!source) return "";
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
    source.currentState,
    source.level,
    source.result,
  ].map(value => String(value ?? "").toUpperCase());
  return values.includes(expected);
}

function readState(source: Record<string, any> | undefined, fallback = "—") {
  const state = textField(
    source,
    "state",
    "status",
    "operationalState",
    "currentState",
    "level",
    "result"
  ).toUpperCase();
  return state || fallback;
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

function formatRelativeReevaluation(value: unknown) {
  if (!value) return "Próxima reavaliação em até 15 minutos";
  const next = new Date(String(value)).getTime();
  if (!Number.isFinite(next)) return "Próxima reavaliação em até 15 minutos";
  const minutes = Math.max(1, Math.round((next - Date.now()) / 60000));
  if (minutes <= 0) return "Reavaliação em andamento";
  return `Próxima reavaliação em ${minutes} minuto${minutes === 1 ? "" : "s"}`;
}

function isRecentDate(value: unknown, hours = 48) {
  if (!value) return false;
  const time = new Date(String(value)).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= hours * 60 * 60 * 1000;
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
  const order = ["overdue", "late-orders", "appointments", "unassigned"];
  return order
    .map(id => signals.find(signal => signal.id === id))
    .filter(Boolean)
    .slice(0, 3)
    .map(signal => {
      if (!signal) throw new Error("Invalid signal");
      if (signal.id === "overdue") {
        return {
          problem: "Cobrar clientes em atraso",
          consequence: `${signal.count} cobrança(s) vencida(s). Impacto: receita parada.`,
          recommendation:
            "Abrir a fila de cobranças vencidas e priorizar contato.",
          primaryActionLabel: "Abrir cobrança",
          primaryPath: signal.path,
        };
      }
      if (signal.id === "late-orders") {
        return {
          problem: "Resolver O.S. atrasadas",
          consequence: `${signal.count} O.S. fora do prazo. Impacto: previsibilidade em queda.`,
          recommendation:
            "Abrir O.S. atrasadas e atualizar responsável ou prazo.",
          primaryActionLabel: "Abrir O.S.",
          primaryPath: signal.path,
        };
      }
      if (signal.id === "appointments") {
        return {
          problem: "Confirmar agendamentos pendentes",
          consequence: `${signal.count} agendamento(s) sem fechamento. Impacto: agenda pouco confiável.`,
          recommendation:
            "Abrir agendamentos e confirmar, concluir ou cancelar.",
          primaryActionLabel: "Abrir agendamento",
          primaryPath: signal.path,
        };
      }
      return {
        problem: "Atribuir responsáveis",
        consequence: `${signal.count} O.S. sem dono. Impacto: fila invisível.`,
        recommendation: "Definir responsável para cada O.S. aberta.",
        primaryActionLabel: "Abrir O.S.",
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
  const automaticActionCount = metric(
    summary,
    "automaticActions",
    "actionsExecuted",
    "autoActions"
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
        title: "Cobranças vencidas",
        reason: `${overdueCharges.length} cobrança(s) vencida(s)`,
        impact: "Risco financeiro crescente",
        priority: overdueCharges.length >= 3 ? "critical" : "high",
        count: overdueCharges.length,
        cta: "Abrir cobrança",
        path: "/finances?status=OVERDUE&source=governance",
        source: "Financeiro",
      });
    }
    if (delayedOrders.length > 0) {
      items.push({
        id: "late-orders",
        title: "O.S. atrasadas",
        reason: `${delayedOrders.length} O.S. atrasada(s)`,
        impact: "Aumento do risco operacional",
        priority: delayedOrders.length >= 3 ? "critical" : "high",
        count: delayedOrders.length,
        cta: "Abrir O.S.",
        path: "/service-orders?filter=late&source=governance",
        source: "Ordens de Serviço",
      });
    }
    if (staleAppointments.length > 0) {
      items.push({
        id: "appointments",
        title: "Agendamentos sem fechamento",
        reason: `${staleAppointments.length} agendamento(s) pendente(s)`,
        impact: "Perda de previsibilidade",
        priority: "medium",
        count: staleAppointments.length,
        cta: "Abrir agendamento",
        path: "/appointments?source=governance",
        source: "Agendamentos",
      });
    }
    if (unassignedOrders.length > 0) {
      items.push({
        id: "unassigned",
        title: "O.S. sem responsável",
        reason: `${unassignedOrders.length} O.S. sem responsável`,
        impact: "Fila operacional sem dono",
        priority: "medium",
        count: unassignedOrders.length,
        cta: "Abrir O.S.",
        path: "/service-orders?filter=unassigned&source=governance",
        source: "Ordens de Serviço",
      });
    }
    if (backendAlerts > 0 || governanceRiskScore >= 30) {
      items.push({
        id: "risk-score",
        title: "Risco consolidado",
        reason: `${backendAlerts || 1} alerta(s) de risco`,
        impact: "Risco transversal em acompanhamento",
        priority: governanceRiskScore >= 70 ? "critical" : "high",
        count: Math.max(backendAlerts, 1),
        cta: "Abrir Timeline",
        path: "/timeline?module=governance",
        source: "Governança",
      });
    }
    if (!hasRecentRun && runs.length === 0) {
      items.push({
        id: "no-recent-run",
        title: "Sem avaliação recente",
        reason: "Sem execução recente registrada",
        impact: "Trilha oficial precisa ser conferida",
        priority: "medium",
        count: 1,
        cta: "Abrir Timeline",
        path: "/timeline?module=governance",
        source: "Timeline",
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
  const state = stateFromSignals({ signals, riskScore, summary, runs });
  const dominantImpact = signals[0]?.impact ?? "Operação sem restrição";
  const nextReevaluation = formatRelativeReevaluation(
    summary.nextEvaluationAt ?? summary.nextRunAt ?? latestRun?.nextEvaluationAt
  );
  const priorityActions = buildPriorityActions(signals);
  const officialEvidence = runs
    .map((run: any, index: number): OfficialEvidence | null => {
      const occurredAt =
        run?.finishedAt ??
        run?.completedAt ??
        run?.createdAt ??
        run?.startedAt ??
        run?.occurredAt;
      if (!occurredAt || formatDateTime(occurredAt) === "—") return null;
      return {
        id: String(run?.id ?? `governance-evidence-${index}`),
        event:
          textField(run, "summary", "message", "reason", "event", "type") ||
          "Avaliação de governança registrada",
        source:
          textField(run, "source", "module", "actorName", "actor") ||
          "Governança",
        occurredAt: formatDateTime(occurredAt),
        impact:
          textField(run, "impact", "result", "status") ||
          "Sustenta o estado operacional atual",
      };
    })
    .filter(Boolean)
    .slice(0, 5) as OfficialEvidence[];

  const history = runs
    .map((run: any, index: number): GovernanceHistoryItem | null => {
      const occurredAt =
        run?.finishedAt ??
        run?.completedAt ??
        run?.createdAt ??
        run?.startedAt ??
        run?.occurredAt;
      if (!occurredAt || formatDateTime(occurredAt) === "—") return null;
      return {
        id: String(run?.id ?? `governance-history-${index}`),
        previousState: textField(run, "previousState", "fromState") || "—",
        currentState: readState(run, state),
        reason:
          textField(run, "reason", "summary", "message") ||
          "Avaliação oficial registrada pela governança.",
        occurredAt: formatDateTime(occurredAt),
      };
    })
    .filter(Boolean)
    .slice(0, 4) as GovernanceHistoryItem[];

  const policies = [
    {
      name: "Cobrança vencida > 3 dias",
      objective: "Reduzir receita parada",
      active: overdueCharges.length > 0 || policyAppliedCount > 0,
    },
    {
      name: "Priorização automática",
      objective: "Ordenar intervenção por risco",
      active: signals.length > 0 || automaticActionCount > 0,
    },
    {
      name: "Reavaliação operacional",
      objective: "Manter estado atualizado",
      active: hasRecentRun || runs.length > 0,
    },
  ];

  return (
    <AppPageShell className="p-4 md:p-6">
      <AppPageHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text-muted)]">
              Governança
            </p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] md:text-3xl">
              Centro de supervisão operacional
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
              Detecta sinais, interpreta impacto e orienta a intervenção sem
              expor logs técnicos.
            </p>
          </div>
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
        </div>
      </AppPageHeader>

      <AppSectionCard className="border-[var(--border-strong)] p-5 md:p-7">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
          <div>
            <AppStatusBadge label={state} />
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text-primary)] md:text-6xl">
              {state}
            </h2>
            <div className="mt-5 grid gap-3 text-base text-[var(--text-secondary)] sm:grid-cols-3">
              <p>
                <strong className="block text-[var(--text-primary)]">
                  {signals.length} sinais ativos
                </strong>
                Nível de risco {riskLevel}
              </p>
              <p>
                <strong className="block text-[var(--text-primary)]">
                  {dominantImpact}
                </strong>
                Principal impacto
              </p>
              <p>
                <strong className="block text-[var(--text-primary)]">
                  {nextReevaluation}
                </strong>
                Ciclo de governança
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--surface-secondary)] p-4 text-sm text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">
              Última avaliação
            </p>
            <p className="mt-1">
              {runs.length ? formatDateTime(lastRunAt) : "Sem execução recente"}
            </p>
            <p className="mt-3">
              {signals.length
                ? "A operação exige intervenção direcionada."
                : "Nenhuma restrição operacional foi detectada."}
            </p>
          </div>
        </div>
      </AppSectionCard>

      <AppSectionCard>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Por que a operação está nesse estado?
        </h2>
        {signals.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {signals.slice(0, 4).map(signal => (
              <div
                key={signal.id}
                className="rounded-xl bg-[var(--surface-secondary)] p-4"
              >
                <p className="font-medium text-[var(--text-primary)]">
                  {signal.reason}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Impacto: {signal.impact}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <AppEmptyState
            title="Nenhum problema principal nesta leitura"
            description="As fontes carregadas não retornaram cobrança vencida, O.S. atrasada ou agendamento pendente."
          />
        )}
      </AppSectionCard>

      <AppSectionCard>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              Faça agora
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Próxima melhor ação: no máximo três ações operacionais para
              reduzir o risco atual.
            </p>
          </div>
          <AppStatusBadge label={`${priorityActions.length} ações`} />
        </div>
        {priorityActions.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {priorityActions.map(action => (
              <article
                key={action.problem}
                className="rounded-xl bg-[var(--surface-secondary)] p-4"
              >
                <h3 className="font-semibold text-[var(--text-primary)]">
                  {action.problem}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {action.consequence}
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {action.recommendation}
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  onClick={() => navigate(action.primaryPath)}
                >
                  {action.primaryActionLabel}
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <AppEmptyState
            title="Nenhuma ação prioritária"
            description="A governança não encontrou intervenção operacional urgente nesta leitura."
          />
        )}
      </AppSectionCard>

      <AppSectionCard>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          O que o sistema já fez
        </h2>
        <ul className="mt-4 grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-3">
          <li>✓ Atualizou estado para {state}</li>
          <li>✓ Registrou {signals.length} sinal(is) ativo(s)</li>
          <li>✓ Recalculou risco {riskLevel}</li>
          {automaticActionCount > 0 ? (
            <li>✓ Registrou {automaticActionCount} ação(ões) automática(s)</li>
          ) : null}
        </ul>
      </AppSectionCard>

      <AppSectionCard>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Evidências oficiais
        </h2>
        {officialEvidence.length ? (
          <AppTimeline className="mt-4">
            {officialEvidence.map(event => (
              <AppTimelineItem key={event.id}>
                <div className="grid gap-2 md:grid-cols-[1fr_0.7fr_0.7fr_1fr]">
                  <p className="font-medium text-[var(--text-primary)]">
                    {event.event}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {event.source}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {event.occurredAt}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {event.impact}
                  </p>
                </div>
              </AppTimelineItem>
            ))}
          </AppTimeline>
        ) : (
          <AppEmptyState
            title="Sem evidência oficial retornada"
            description="A Timeline não retornou eventos de governança nesta leitura. Abra a Timeline para investigar a trilha completa."
            action={
              <Button
                variant="outline"
                onClick={() => navigate("/timeline?module=governance")}
              >
                Abrir Timeline
              </Button>
            }
          />
        )}
      </AppSectionCard>

      <AppSectionCard>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Histórico de governança
        </h2>
        {history.length ? (
          <AppTimeline className="mt-4">
            {history.map(item => (
              <AppTimelineItem key={item.id}>
                <p className="font-medium text-[var(--text-primary)]">
                  {item.previousState} → {item.currentState}
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Motivo: {item.reason}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Data: {item.occurredAt}
                </p>
              </AppTimelineItem>
            ))}
          </AppTimeline>
        ) : (
          <AppEmptyState
            title="Sem histórico auditável"
            description="Nenhuma mudança de governança foi retornada pelas fontes oficiais carregadas."
          />
        )}
      </AppSectionCard>

      <AppSectionCard>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Políticas ativas
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {policies.map(policy => (
            <article
              key={policy.name}
              className="rounded-xl bg-[var(--surface-secondary)] p-4"
            >
              <p className="font-medium text-[var(--text-primary)]">
                {policy.name}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {policy.objective}
              </p>
              <div className="mt-3">
                <AppStatusBadge label={policy.active ? "Ativa" : "Sem sinal"} />
              </div>
            </article>
          ))}
        </div>
      </AppSectionCard>
    </AppPageShell>
  );
}
