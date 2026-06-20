import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/design-system";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock3,
  Eye,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import {
  AppPageHeader,
  AppPageShell,
  AppSectionCard,
  AppStatusBadge,
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
  priority: Priority;
};

type OfficialEvidence = {
  id: string;
  event: string;
  source: string;
  occurredAt: string;
  impact: string;
  entity: string;
  actionPath?: string;
};

type GovernanceHistoryItem = {
  id: string;
  previousState: string;
  currentState: string;
  reason: string;
  occurredAt: string;
};

type ActivePolicy = {
  name: string;
  objective: string;
  status: "ATIVA" | "SEM SINAL" | "BLOQUEADA";
  impactando: string;
  lastEvaluation: string;
  description: string;
};

const stateCopy: Record<
  GovernanceState,
  {
    label: string;
    title: string;
    tone: "success" | "warning" | "danger" | "neutral";
  }
> = {
  NORMAL: { label: "NORMAL", title: "Operação saudável", tone: "success" },
  WARNING: { label: "ATENÇÃO", title: "Atenção", tone: "warning" },
  RESTRICTED: {
    label: "RESTRITA",
    title: "Operação comprometida",
    tone: "danger",
  },
  SUSPENDED: { label: "SUSPENSA", title: "Operação bloqueada", tone: "danger" },
};

function priorityLabel(priority: Priority) {
  if (priority === "critical") return "Crítica";
  if (priority === "high") return "Alta";
  return "Média";
}

function pluralizePt(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function operationalPriorityLabel(action: NextBestAction) {
  if (action.primaryPath.includes("finances")) return "Impacto financeiro";
  if (action.primaryPath.includes("service-orders"))
    return "Impacto operacional";
  if (action.primaryPath.includes("appointments"))
    return "Impacto de planejamento";
  return "Impacto operacional";
}

function actionTitle(action: NextBestAction) {
  if (action.primaryPath.includes("finances")) return "Cobrar agora";
  if (action.primaryPath.includes("service-orders")) return "Resolver execução";
  if (action.primaryPath.includes("appointments")) return "Confirmar agenda";
  return action.problem;
}

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

function moneyValue(source: Record<string, any>) {
  for (const key of [
    "amount",
    "total",
    "value",
    "totalAmount",
    "amountDue",
    "balance",
  ]) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function relativeLastAnalysis(value: unknown) {
  if (!value) return "Sem execução recente";
  const time = new Date(String(value)).getTime();
  if (!Number.isFinite(time)) return "Sem execução recente";
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (minutes < 60)
    return `Última análise há ${minutes} minuto${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48)
    return `Última análise há ${hours} hora${hours === 1 ? "" : "s"}`;
  return `Última análise em ${formatDateTime(value)}`;
}

function isRecentDate(value: unknown, hours = 48) {
  if (!value) return false;
  const time = new Date(String(value)).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= hours * 60 * 60 * 1000;
}

function normalizeGovernanceReason(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") {
    return "Motivo não retornado pelas fontes oficiais.";
  }
  return trimmed;
}

function evidenceIconFor(event: OfficialEvidence) {
  const text = `${event.event} ${event.source}`.toLowerCase();
  if (text.includes("pagamento") || text.includes("cobran")) return FileCheck2;
  if (text.includes("risco") || text.includes("govern")) return ShieldCheck;
  return Activity;
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
          consequence: `${pluralizePt(signal.count, "cobrança vencida", "cobranças vencidas")}. Impacto: receita parada.`,
          recommendation:
            "Abrir a fila de cobranças vencidas e priorizar contato.",
          primaryActionLabel: "Abrir cobrança",
          primaryPath: signal.path,
          priority: signal.priority,
        };
      }
      if (signal.id === "late-orders") {
        return {
          problem: "Resolver O.S. atrasadas",
          consequence: `${pluralizePt(signal.count, "O.S. atrasada", "O.S. atrasadas")}. Impacto: previsibilidade em queda.`,
          recommendation:
            "Abrir O.S. atrasadas e atualizar responsável ou prazo.",
          primaryActionLabel: "Abrir O.S.",
          primaryPath: signal.path,
          priority: signal.priority,
        };
      }
      if (signal.id === "appointments") {
        return {
          problem: "Confirmar agendamentos pendentes",
          consequence: `${pluralizePt(signal.count, "agendamento pendente", "agendamentos pendentes")}. Impacto: agenda pouco confiável.`,
          recommendation:
            "Abrir agendamentos e confirmar, concluir ou cancelar.",
          primaryActionLabel: "Abrir agendamento",
          primaryPath: signal.path,
          priority: signal.priority,
        };
      }
      return {
        problem: "Atribuir responsáveis",
        consequence: `${pluralizePt(signal.count, "O.S. sem responsável", "O.S. sem responsáveis")}. Impacto: fila invisível.`,
        recommendation: "Definir responsável para cada O.S. aberta.",
        primaryActionLabel: "Abrir O.S.",
        primaryPath: signal.path,
        priority: signal.priority,
      };
    });
}

function consequenceForSignal(signal: Signal) {
  if (signal.id === "overdue") return "Receita parada.";
  if (signal.id === "late-orders")
    return "Perda de previsibilidade da execução.";
  if (signal.id === "appointments") return "Agenda menos confiável.";
  if (signal.id === "no-recent-run") return "Trilha operacional incompleta.";
  if (signal.id === "unassigned") return "Fila sem responsável claro.";
  return "Decisão operacional exige acompanhamento.";
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
        reason: pluralizePt(
          overdueCharges.length,
          "cobrança vencida",
          "cobranças vencidas"
        ),
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
        reason: pluralizePt(
          delayedOrders.length,
          "O.S. atrasada",
          "O.S. atrasadas"
        ),
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
        reason: pluralizePt(
          staleAppointments.length,
          "agendamento pendente",
          "agendamentos pendentes"
        ),
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
        reason: pluralizePt(
          backendAlerts || 1,
          "alerta de risco",
          "alertas de risco"
        ),
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

  const overdueAmount = overdueCharges.reduce(
    (total, charge) => total + moneyValue(charge),
    0
  );
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
  const statePresentation = stateCopy[state];
  const mainRisk = signals[0];
  const principalReason = mainRisk
    ? mainRisk.reason
    : state === "NORMAL"
      ? "Nenhum bloqueio crítico retornado pelas fontes oficiais."
      : normalizeGovernanceReason(
          textField(summary, "reason", "message", "summary")
        );
  const impactMetrics = [
    {
      label: "Receita em risco",
      value: overdueAmount > 0 ? formatCurrency(overdueAmount) : "R$ 0,00",
      tone: overdueAmount > 0 ? "warning" : "success",
    },
    {
      label: "Clientes afetados",
      value: String(
        new Set(
          overdueCharges.map(charge =>
            String(
              charge?.customerId ??
                charge?.customer?.id ??
                charge?.customerName ??
                charge?.id
            )
          )
        ).size || 0
      ),
      tone: overdueCharges.length > 0 ? "warning" : "success",
    },
    {
      label: "O.S. afetadas",
      value: String(delayedOrders.length + unassignedOrders.length),
      tone:
        delayedOrders.length + unassignedOrders.length > 0
          ? "warning"
          : "success",
    },
    {
      label: "Agendamentos afetados",
      value: String(staleAppointments.length),
      tone: staleAppointments.length > 0 ? "warning" : "success",
    },
  ];
  const decisionFlow = [
    {
      icon: AlertTriangle,
      title: "Sinal detectado",
      description: mainRisk ? mainRisk.title : "Nenhum sinal crítico",
      status: mainRisk ? mainRisk.reason : "Fontes carregadas",
      tone: mainRisk ? "warning" : "success",
    },
    {
      icon: Eye,
      title: "Evidência avaliada",
      description: runs.length
        ? "Execução registrada"
        : "Aguardando próxima execução",
      status: runs.length ? "Com registro oficial" : "Sem evidência registrada",
      tone: runs.length ? "success" : "neutral",
    },
    {
      icon: Activity,
      title: "Impacto calculado",
      description:
        overdueAmount > 0 || delayedOrders.length || staleAppointments.length
          ? `${formatCurrency(overdueAmount)} · ${delayedOrders.length + unassignedOrders.length} O.S. · ${staleAppointments.length} agendas`
          : "Sem impacto crítico",
      status: riskLevel,
      tone: riskScore >= 30 ? "warning" : "success",
    },
    {
      icon: ShieldCheck,
      title: "Estado definido",
      description: statePresentation.title,
      status: statePresentation.label,
      tone: statePresentation.tone,
    },
  ];
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
        entity:
          textField(
            run,
            "entityName",
            "customerName",
            "chargeNumber",
            "serviceOrderCode",
            "reference"
          ) || "Leitura oficial",
        actionPath: textField(run, "href", "url", "path") || undefined,
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
        reason: normalizeGovernanceReason(
          textField(run, "reason", "summary", "message")
        ),
        occurredAt: formatDateTime(occurredAt),
      };
    })
    .filter(Boolean)
    .slice(0, 4) as GovernanceHistoryItem[];

  const policies = [
    {
      name: "Cobranças vencidas recebem prioridade máxima",
      objective: "Destravar receita afetada",
      status:
        overdueCharges.length > 0 || policyAppliedCount > 0
          ? "ATIVA"
          : "SEM SINAL",
      impactando:
        overdueCharges.length > 0
          ? pluralizePt(
              overdueCharges.length,
              "cobrança vencida",
              "cobranças vencidas"
            )
          : "Sem impacto ativo",
      lastEvaluation: runs.length
        ? formatDateTime(lastRunAt)
        : "Aguardando execução oficial",
      description:
        overdueCharges.length > 0
          ? "Cobranças vencidas recebem prioridade máxima para destravar receita."
          : "Sem cobrança vencida retornada, a política não cria ação nesta leitura.",
    },
    {
      name: "Sinais críticos são ordenados por impacto",
      objective: "Mostrar o que muda a operação primeiro",
      status:
        signals.length > 0 || automaticActionCount > 0 ? "ATIVA" : "SEM SINAL",
      impactando:
        signals.length > 0
          ? pluralizePt(
              signals.length,
              "sinal operacional",
              "sinais operacionais"
            )
          : "Sem impacto ativo",
      lastEvaluation: runs.length
        ? formatDateTime(lastRunAt)
        : "Aguardando execução oficial",
      description:
        signals.length > 0
          ? "Sinais críticos são ordenados por impacto antes da fila de ação."
          : "Sem sinal prioritário retornado pelas fontes oficiais.",
    },
    {
      name: "Estado operacional é recalculado automaticamente",
      objective: "Manter a decisão atualizada",
      status: hasRecentRun || runs.length > 0 ? "ATIVA" : "SEM SINAL",
      impactando:
        hasRecentRun || runs.length > 0
          ? "Estado operacional"
          : "Sem impacto ativo",
      lastEvaluation: runs.length
        ? formatDateTime(lastRunAt)
        : "Aguardando execução oficial",
      description: hasRecentRun
        ? "Estado operacional é recalculado automaticamente com a última leitura."
        : "Aguardando próxima execução registrada pela governança.",
    },
    {
      name: "Evidências são registradas em Timeline",
      objective: "Preservar prova operacional",
      status: runs.length > 0 ? "ATIVA" : "SEM SINAL",
      impactando:
        runs.length > 0
          ? pluralizePt(runs.length, "registro oficial", "registros oficiais")
          : "Sem evidência nesta leitura",
      lastEvaluation: runs.length
        ? formatDateTime(lastRunAt)
        : "Aguardando execução oficial",
      description:
        runs.length > 0
          ? "Histórico oficial usado como trilha de auditoria."
          : "A regra não fabrica provas; aguarda registros oficiais.",
    },
  ] satisfies ActivePolicy[];

  return (
    <AppPageShell className="gap-3 p-3 md:gap-4 md:p-5">
      <AppPageHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--text-muted)]">
              Governança
            </p>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] md:text-3xl">
              Centro de supervisão operacional
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)]">
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

      <AppSectionCard
        variant="default"
        className="overflow-hidden border-[color-mix(in_srgb,var(--app-accent)_16%,var(--app-border-subtle))] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--app-accent)_14%,transparent),transparent_36%),linear-gradient(180deg,#071f2a,var(--app-surface-1))] p-0 shadow-none"
      >
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(330px,0.95fr)]">
          <div className="p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <AppStatusBadge
                label={`Estado: ${statePresentation.label}`}
                tone={statePresentation.tone}
              />
              <span className="text-xs text-[var(--text-muted)]">
                Última execução: {formatDateTime(lastRunAt)}
              </span>
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-5xl">
              {statePresentation.title}
            </h2>
            <p className="mt-3 max-w-2xl text-base text-[var(--text-secondary)]">
              {principalReason}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {impactMetrics.map(metric => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    {metric.label}
                  </p>
                  <p
                    className={
                      metric.tone === "warning"
                        ? "mt-2 text-xl font-semibold text-[var(--app-warning)]"
                        : "mt-2 text-xl font-semibold text-[var(--app-success)]"
                    }
                  >
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--app-accent)_20%,var(--app-border-subtle))] bg-[color-mix(in_srgb,var(--app-accent)_7%,transparent)] p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--app-accent)]">
                  Próxima melhor ação
                </p>
                <p className="mt-1 font-semibold text-[var(--text-primary)]">
                  {mainRisk ? mainRisk.cta : "Acompanhar evolução"}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {mainRisk ? consequenceForSignal(mainRisk) : nextReevaluation}
                </p>
              </div>
              <Button
                onClick={() =>
                  navigate(
                    mainRisk ? mainRisk.path : "/timeline?module=governance"
                  )
                }
              >
                {mainRisk ? mainRisk.cta : "Abrir Timeline"}
              </Button>
            </div>
          </div>
          <aside className="border-t border-white/10 bg-white/[0.025] p-5 md:p-6 lg:border-l lg:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--app-accent)]">
              Visão executiva
            </p>
            <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
              O que está acontecendo agora
            </h3>
            <div className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
              <p>
                <strong className="text-[var(--text-primary)]">Sinal:</strong>{" "}
                {mainRisk ? mainRisk.title : "Sem sinal crítico"}
              </p>
              <p>
                <strong className="text-[var(--text-primary)]">Impacto:</strong>{" "}
                {overdueAmount > 0 ||
                delayedOrders.length ||
                staleAppointments.length
                  ? `${formatCurrency(overdueAmount)} em receita, ${delayedOrders.length + unassignedOrders.length} O.S. e ${staleAppointments.length} agendamentos afetados.`
                  : "Sem consequência operacional crítica nas fontes carregadas."}
              </p>
              <p>
                <strong className="text-[var(--text-primary)]">Decisão:</strong>{" "}
                Estado {statePresentation.label.toLowerCase()}.
              </p>
              <p>
                <strong className="text-[var(--text-primary)]">
                  Evidência:
                </strong>{" "}
                {runs.length
                  ? `${runs.length} registro(s) oficial(is) carregado(s).`
                  : "Nenhuma evidência registrada nesta leitura."}
              </p>
            </div>
          </aside>
        </div>
      </AppSectionCard>

      <AppSectionCard variant="default" className="p-4 md:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--app-accent)]">
              Intervenções e ações prioritárias
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              Faça agora
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Ações priorizadas em linguagem operacional, mantendo a severidade
              apenas como critério interno.
            </p>
          </div>
          <AppStatusBadge label={`${priorityActions.length} ações`} />
        </div>
        {priorityActions.length ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {priorityActions.map((action, index) => (
              <article
                key={action.problem}
                className="flex min-h-full flex-col rounded-2xl border border-[var(--app-border-subtle)] bg-[linear-gradient(180deg,var(--app-surface-2),var(--app-surface-1))] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--app-accent)] text-sm font-semibold text-slate-950">
                    {index + 1}
                  </span>
                  <AppStatusBadge
                    label={operationalPriorityLabel(action)}
                    tone={
                      action.priority === "critical"
                        ? "danger"
                        : action.priority === "high"
                          ? "warning"
                          : "neutral"
                    }
                  />
                </div>
                <h3 className="mt-3 font-semibold text-[var(--text-primary)]">
                  {actionTitle(action)}
                </h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {action.consequence}
                </p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {action.recommendation}
                </p>
                <span className="mt-3 w-fit rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Prioridade {priorityLabel(action.priority)}
                </span>
                <Button
                  className="mt-3 w-full justify-center"
                  variant="outline"
                  onClick={() => navigate(action.primaryPath)}
                >
                  {action.primaryActionLabel}
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="font-semibold text-[var(--text-primary)]">
              Nenhuma intervenção urgente
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              A governança não encontrou bloqueios operacionais críticos nesta
              leitura.
            </p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {nextReevaluation}
            </p>
          </div>
        )}
      </AppSectionCard>

      <AppSectionCard variant="evidence" className="p-4 md:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--app-accent)]">
          Fluxo de decisão da governança
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
          Sinal → Impacto → Decisão → Ação → Evidência
        </h2>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {decisionFlow.map((step, index) => {
            const StepIcon = step.icon;
            return (
              <article
                key={step.title}
                className="relative rounded-2xl border border-white/10 bg-white/[0.025] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--app-accent)_14%,transparent)] text-[var(--app-accent)]">
                    <StepIcon className="h-4 w-4" />
                  </span>
                  <AppStatusBadge
                    label={String(step.status)}
                    tone={step.tone as any}
                  />
                </div>
                <h3 className="mt-3 font-semibold text-[var(--text-primary)]">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {step.description}
                </p>
                {index < decisionFlow.length - 1 ? (
                  <ArrowRight className="absolute -right-5 top-1/2 hidden h-5 w-5 text-[var(--app-accent)] lg:block" />
                ) : null}
              </article>
            );
          })}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h3 className="font-semibold text-[var(--text-primary)]">
              Sinais que sustentam a decisão
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {signals.length
                ? signals
                    .slice(0, 3)
                    .map(signal => signal.reason)
                    .join(" · ")
                : "Nenhum sinal crítico retornado."}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h3 className="font-semibold text-[var(--text-primary)]">
              O que isso significa?
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {state === "NORMAL"
                ? "A leitura atual não exige bloqueio ou contenção."
                : `A operação exige atenção porque o risco ${riskLevel} já tem consequência mensurável ou trilha incompleta.`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <h3 className="font-semibold text-[var(--text-primary)]">
              Recomendação operacional
            </h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {mainRisk
                ? `Priorize: ${mainRisk.cta}.`
                : "Acompanhe a próxima revisão e mantenha a operação em observação."}
            </p>
          </div>
        </div>
      </AppSectionCard>

      <AppSectionCard variant="evidence" className="p-4 md:p-5">
        <div className="border-b border-[var(--app-border-subtle)] pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--app-accent)]">
            Painel de auditoria
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            Evidências e histórico na mesma trilha
          </h2>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-2xl bg-[color-mix(in_srgb,var(--app-surface-2)_78%,transparent)] p-4">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Evidências oficiais
            </h3>
            {officialEvidence.length ? (
              <div className="mt-3 grid gap-3">
                {officialEvidence.map(event => {
                  const EvidenceIcon = evidenceIconFor(event);
                  return (
                    <article
                      key={event.id}
                      className="rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-2)] p-4"
                    >
                      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-3)] text-[var(--app-accent)]">
                          <EvidenceIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[var(--text-primary)]">
                            {event.event}
                          </h3>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {event.source} · {event.entity}
                          </p>
                          <p className="mt-2 text-sm text-[var(--text-secondary)]">
                            <strong className="text-[var(--text-primary)]">
                              Impacto: {""}
                            </strong>
                            {event.impact}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 md:items-end">
                          <span className="text-sm text-[var(--text-muted)]">
                            {event.occurredAt}
                          </span>
                          {event.actionPath ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(event.actionPath!)}
                            >
                              Abrir prova
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--app-accent)_32%,var(--app-border-subtle))] bg-[color-mix(in_srgb,var(--app-accent)_6%,var(--app-surface-1))] p-4 text-sm text-[var(--text-secondary)]">
                <p className="font-semibold text-[var(--text-primary)]">
                  Nenhuma evidência registrada nesta leitura.
                </p>
                <p className="mt-1">
                  A próxima execução de governança adicionará provas
                  operacionais aqui.
                </p>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/timeline?module=governance")}
                >
                  Abrir Timeline
                </Button>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-[color-mix(in_srgb,var(--app-surface-2)_78%,transparent)] p-4">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Histórico de governança
            </h3>
            {history.length ? (
              <div className="mt-3 grid gap-3">
                {history.map(item => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-2)] p-4"
                  >
                    <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-3)] text-[var(--app-accent)]">
                        <Clock3 className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <AppStatusBadge
                            label={item.previousState}
                            tone="neutral"
                          />
                          <span className="text-sm text-[var(--text-muted)]">
                            →
                          </span>
                          <AppStatusBadge
                            label={item.currentState}
                            tone="accent"
                          />
                        </div>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">
                          <strong className="text-[var(--text-primary)]">
                            Motivo: {""}
                          </strong>
                          {item.reason}
                        </p>
                      </div>
                      <span className="text-sm text-[var(--text-muted)] md:text-right">
                        {item.occurredAt}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-[var(--app-border-subtle)] bg-[linear-gradient(180deg,var(--app-surface-2),var(--app-surface-1))] p-4 text-sm text-[var(--text-secondary)]">
                <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-3)] text-[var(--app-accent)]">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                      Container de decisões
                    </p>
                    <p className="mt-1 font-semibold text-[var(--text-primary)]">
                      Nenhuma mudança de governança encontrada nesta leitura.
                    </p>
                    <p className="mt-1">
                      A próxima execução registrada aparecerá aqui.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </AppSectionCard>

      <AppSectionCard variant="evidence" className="p-4 md:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--app-accent)]">
          Painel de controle
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
          Regras que influenciaram a decisão
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {policies.map(policy => (
            <article
              key={policy.name}
              className="relative flex min-h-full flex-col overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--app-accent)_18%,var(--app-border-subtle))] bg-[linear-gradient(180deg,var(--app-surface-1),var(--app-surface-2))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,transparent,var(--app-accent),transparent)] opacity-40" />
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--app-border-subtle)] bg-[var(--app-surface-3)] text-[var(--app-accent)] shadow-inner">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span
                  className={
                    policy.status === "ATIVA"
                      ? "rounded-full border border-[color-mix(in_srgb,var(--app-success)_45%,transparent)] bg-[color-mix(in_srgb,var(--app-success)_14%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-success)] shadow-[0_0_18px_color-mix(in_srgb,var(--app-success)_26%,transparent)]"
                      : "rounded-full border border-[color-mix(in_srgb,var(--app-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-accent)]"
                  }
                >
                  {policy.status}
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-[var(--text-primary)]">
                {policy.name}
              </h3>
              <div className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
                <p className="font-medium text-[var(--text-primary)]">
                  {policy.objective}
                </p>
                <p>{policy.impactando}</p>
                <p>{policy.lastEvaluation}</p>
              </div>
              <p className="mt-3 border-t border-[var(--app-border-subtle)] pt-3 text-sm text-[var(--text-muted)]">
                {policy.description}
              </p>
            </article>
          ))}
        </div>
      </AppSectionCard>
    </AppPageShell>
  );
}
