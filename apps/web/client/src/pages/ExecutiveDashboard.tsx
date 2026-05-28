import { useEffect, useMemo, useState } from "react";
import { operationalCopy } from "@/lib/operational-semantics";
import { detectOperationalInterventions, getPrimaryOperationalIntervention } from "@/lib/operational-interventions";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageSquareWarning,
  MoreHorizontal,
  ShieldAlert,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useQuery } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppStatCard } from "@/components/app-system";
import { useRunAction } from "@/hooks/useRunAction";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import {
  AppPageEmptyState,
  AppPageErrorState,
  AppOperationalHeader,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { normalizeOperationalState } from "@/lib/operations";
import {
  buildWhatsAppExecutionPath,
  formatWhatsAppExecutionDate,
  whatsappActionLabel,
  type WhatsAppActionExecution,
} from "@/lib/whatsappActionExecution";

type DashboardState =
  | "healthy"
  | "alert"
  | "critical"
  | "empty"
  | "error"
  | "loading";
type Severity = "critical" | "high" | "medium";
type DashboardRecord = Record<string, unknown>;
type SignalSeverity = "CRITICAL" | "WARNING" | "INFO";
type OperationalSignal = {
  id: string;
  severity: SignalSeverity;
  area: string;
  title: string;
  summary?: string;
  impact?: string;
  suggestedAction?: string;
  actionType?: string;
  serviceOrderId?: string | null;
  chargeId?: string | null;
  messageId?: string | null;
  entityId?: string | null;
};

type NextBestActionSignal = {
  id?: string;
  actionType?: string;
  entityId?: string | null;
  serviceOrderId?: string | null;
  chargeId?: string | null;
  messageId?: string | null;
  area?: string;
  title?: string;
  reason?: string;
  impact?: string;
  suggestedAction?: string;
};



type OperationalActionsDiagnostics = {
  pendingRequestedCount: number;
  stuckExecutingCount: number;
  failedLast24hCount: number;
  recoveredLast24hCount: number;
  avgRequestedToExecutedMs: number | null;
  topFailedActionTypes: Array<{ actionType: string; count: number }>;
  recentFailures: Array<{
    id: string;
    actionType: string;
    entityType: string;
    entityId: string;
    failedAt: string;
    failureReason: string | null;
  }>;
  recentStuckExecuting: Array<{
    id: string;
    actionType: string;
    entityType: string;
    entityId: string;
    sourceSignalId: string | null;
    updatedAt: string;
  }>;
};
type AttentionItem = {
  severity: Severity;
  title: string;
  context: string;
  impact: string;
  primaryCtaLabel: string;
  primaryPath: string;
};

type QueueItem = {
  type: string;
  entity: string;
  status: string;
  deadline: string;
  actionLabel: string;
  path: string;
};

type OperationalKpi = {
  label: string;
  value: string;
  helper: string;
  actionLabel: string;
  path: string;
};

const severityWeight: Record<Severity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

const defaultAttentionItems: AttentionItem[] = [
  {
    severity: "critical",
    title: "Cobranças vencidas em lote crítico",
    context: "6 cobranças vencidas há +48h no fechamento do caixa.",
    impact: "Risco de estrangulamento de caixa e atraso de repasses.",
    primaryCtaLabel: "Cobrar agora",
    primaryPath: "/finances?view=charges&status=overdue",
  },
  {
    severity: "critical",
    title: "O.S. atrasadas em rota ativa",
    context: "2 O.S. paradas há mais de 2h após início previsto.",
    impact: "Degrada SLA e empurra atraso para os próximos slots.",
    primaryCtaLabel: "Destravar O.S.",
    primaryPath: "/service-orders?status=attention",
  },
  {
    severity: "high",
    title: "Agendamentos sem confirmação",
    context: "4 clientes sem confirmação para a janela 10:00–12:00.",
    impact: "Risco de ociosidade operacional e quebra de previsibilidade.",
    primaryCtaLabel: "Confirmar agenda",
    primaryPath: "/appointments?status=pending-confirmation",
  },
  {
    severity: "high",
    title: "Falhas em mensagens de confirmação",
    context: "5 mensagens de WhatsApp falharam na última hora.",
    impact: "Aumenta ausência em agendamento e retrabalho.",
    primaryCtaLabel: "Resolver falhas",
    primaryPath: "/timeline?type=whatsapp-failure",
  },
];

const operationalPipeline = [
  {
    stage: "Cliente",
    volume: 138,
    conversion: "30,4%",
    microcontext: "3 sem retorno",
    action: "Ativar follow-up",
    path: "/customers?segment=inactive",
  },
  {
    stage: "Agendamento",
    volume: 42,
    conversion: "66,7%",
    microcontext: "4 sem confirmação",
    action: "Confirmar agenda",
    path: "/appointments?status=pending-confirmation",
  },
  {
    stage: "O.S.",
    volume: 28,
    conversion: "75%",
    microcontext: "2 atrasadas",
    action: "Destravar execução",
    path: "/service-orders?status=attention",
  },
  {
    stage: "Cobrança",
    volume: 21,
    conversion: "71,4%",
    microcontext: "6 vencidas",
    action: "Cobrar carteira",
    path: "/finances?view=charges&status=overdue",
  },
  {
    stage: "Pagamento",
    volume: 15,
    conversion: "Meta 80%",
    microcontext: "abaixo da meta",
    action: "Ver recebimentos",
    path: "/finances?view=paid",
  },
] as const;

const defaultQueue: QueueItem[] = [
  {
    type: "Cobrança vencida",
    entity: "COB-9021 · R$ 4.280 · João Silva",
    status: "Urgente",
    deadline: "Hoje, 11:00",
    actionLabel: "Enviar cobrança",
    path: "/finances?view=charges&status=overdue",
  },
  {
    type: "O.S. atrasada",
    entity: "OS-7841 · Clínica Acácia",
    status: "Atenção",
    deadline: "Hoje, 09:30",
    actionLabel: "Iniciar O.S.",
    path: "/service-orders?status=pending",
  },
  {
    type: "Agendamento",
    entity: "AG-1992 · Clínica Viva",
    status: "Pendente",
    deadline: "Hoje, 10:00",
    actionLabel: "Confirmar",
    path: "/appointments?status=pending-confirmation",
  },
  {
    type: "Cliente sem resposta",
    entity: "Marina Costa · pós-serviço",
    status: "Em risco",
    deadline: "Hoje, 10:15",
    actionLabel: "Responder",
    path: "/customers?segment=needs-contact",
  },
];

const pulseSignals = [
  {
    icon: Clock3,
    tone: "text-[var(--dashboard-warning)]",
    text: "Atraso médio em O.S. subiu para 38min e já compromete a janela da manhã.",
  },
  {
    icon: TrendingDown,
    tone: "text-[var(--dashboard-danger)]",
    text: "Cobrança está travando conversão para pagamento no ponto final do fluxo.",
  },
  {
    icon: MessageSquareWarning,
    tone: "text-[var(--dashboard-danger)]",
    text: "Mensagens falhadas cresceram e elevam risco de no-show em agendamentos críticos.",
  },
  {
    icon: ShieldAlert,
    tone: "text-[var(--dashboard-info)]",
    text: "Risco operacional permanece concentrado em agenda e financeiro neste turno.",
  },
] as const;


const supportedAssistedActionTypes = new Set(["RETRY_WHATSAPP_MESSAGE", "SEND_PAYMENT_REMINDER", "RECALCULATE_RISK", "RUN_GOVERNANCE_CHECK"]);

function resolveAssistedEntityId(signal: OperationalSignal): string | null {
  if (signal.actionType === "RETRY_WHATSAPP_MESSAGE") return signal.messageId ?? signal.entityId ?? null;
  if (signal.actionType === "SEND_PAYMENT_REMINDER") return signal.chargeId ?? signal.entityId ?? null;
  if (signal.actionType === "RECALCULATE_RISK" || signal.actionType === "RUN_GOVERNANCE_CHECK") return signal.entityId ?? null;
  return null;
}

const quickAccess = [
  {
    label: "Financeiro em atraso",
    path: "/finances?view=charges&status=overdue",
  },
  { label: "O.S. com atenção", path: "/service-orders?status=attention" },
  {
    label: "Agenda sem confirmação",
    path: "/appointments?status=pending-confirmation",
  },
  { label: "Timeline de falhas", path: "/timeline?type=whatsapp-failure" },
] as const;

function readDashboardRecord(value: unknown): DashboardRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DashboardRecord)
    : {};
}

function readNumber(record: DashboardRecord, keys: string[], fallback: number) {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const parsed = Number(raw.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatOperationalPeriod() {
  const today = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return `Hoje · ${today} · Turno 08:00–18:00`;
}

function resolveOperationalState(
  alertCount: number,
  criticalCount: number
): DashboardState {
  if (criticalCount > 1) return "critical";
  if (alertCount > 0) return "alert";
  return "healthy";
}

function buildKpis(metrics: DashboardRecord): OperationalKpi[] {
  const revenue = readNumber(
    metrics,
    ["revenue", "totalRevenue", "monthlyRevenue", "periodRevenue"],
    187400
  );
  const openOrders = readNumber(
    metrics,
    ["openServiceOrders", "serviceOrdersOpen", "ordersOpen"],
    18
  );
  const overdueCharges = readNumber(
    metrics,
    ["overdueCharges", "chargesOverdue", "pendingCharges"],
    6
  );
  const averageTicket = readNumber(
    metrics,
    ["averageTicket", "avgTicket", "ticketMedio"],
    892
  );

  return [
    {
      label: "Receita do período",
      value: formatCurrency(revenue),
      helper:
        overdueCharges > 0
          ? `${overdueCharges} cobrança(s) vencida(s) pressionam o caixa.`
          : "Sem bloqueio financeiro crítico no período.",
      actionLabel: "Ver receita",
      path: "/finances?view=revenue",
    },
    {
      label: "Ordens abertas",
      value: String(openOrders),
      helper:
        openOrders > 0
          ? "Priorize atrasadas antes de abrir novas janelas."
          : "Nenhuma O.S. aberta exigindo avanço agora.",
      actionLabel: "Abrir O.S.",
      path: "/service-orders?status=open",
    },
    {
      label: "Cobranças pendentes",
      value: String(
        Math.max(overdueCharges, readNumber(metrics, ["pendingCharges"], 21))
      ),
      helper:
        overdueCharges > 0
          ? `${overdueCharges} vencida(s) formam o gargalo principal.`
          : "Carteira sem vencidos críticos.",
      actionLabel: "Cobranças",
      path: "/finances?view=charges&status=overdue",
    },
    {
      label: "Ticket médio",
      value: formatCurrency(averageTicket),
      helper: "Contexto de margem para decidir descontos e renegociações.",
      actionLabel: "Ver ticket",
      path: "/finances?view=performance",
    },
  ];
}

function normalizeAlerts(rawAlerts: unknown): AttentionItem[] {
  const alerts = Array.isArray(rawAlerts) ? rawAlerts : [];
  const normalized = alerts
    .map((entry, index): AttentionItem | null => {
      const record = readDashboardRecord(entry);
      const severityRaw = String(
        record.severity ?? record.priority ?? "medium"
      ).toLowerCase();
      const severity: Severity =
        severityRaw === "critical" || severityRaw === "high"
          ? severityRaw
          : "medium";
      const title = String(
        record.title ?? record.message ?? "Alerta operacional"
      );
      const context = String(
        record.context ??
          record.description ??
          "Sinal detectado no dashboard operacional."
      );
      const impact = String(
        record.impact ?? "Exige validação para evitar atraso no fluxo."
      );
      const primaryCtaLabel = String(
        record.actionLabel ?? record.ctaLabel ?? "Abrir ação"
      );
      const primaryPath = String(
        record.path ?? record.href ?? "/dashboard/operations?filter=critical"
      );

      if (!title.trim()) return null;

      return {
        severity,
        title: index === 0 ? title : title.slice(0, 96),
        context,
        impact,
        primaryCtaLabel,
        primaryPath,
      };
    })
    .filter((item): item is AttentionItem => Boolean(item));

  return normalized.length > 0 ? normalized : defaultAttentionItems;
}

function AttentionRow({
  item,
  onNavigate,
}: {
  item: AttentionItem;
  onNavigate: (path: string) => void;
}) {
  return (
    <article className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AppStatusBadge
              label={
                item.severity === "critical"
                  ? "Urgente"
                  : item.severity === "high"
                    ? "Atenção"
                    : "Monitorar"
              }
            />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {item.title}
            </p>
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
            {item.context}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Impacto: {item.impact}
          </p>
        </div>
        <Button size="sm" onClick={() => onNavigate(item.primaryPath)}>
          {item.primaryCtaLabel}
        </Button>
      </div>
    </article>
  );
}

function QueueRow({
  item,
  onNavigate,
}: {
  item: QueueItem;
  onNavigate: (path: string) => void;
}) {
  return (
    <article className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {item.type}
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
            {item.entity}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Prazo: {item.deadline}
          </p>
        </div>
        <AppStatusBadge label={item.status} />
      </div>
      <Button
        className="mt-3"
        size="sm"
        variant="outline"
        onClick={() => onNavigate(item.path)}
      >
        {item.actionLabel}
      </Button>
    </article>
  );
}




function formatDurationMs(value: number | null) {
  if (!value || value <= 0) return "—";
  const totalSeconds = Math.round(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}min`;
  return `${minutes}min ${seconds}s`;
}

function formatFailureTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function buildSignalCtaPath(signal: OperationalSignal) {
  if (signal.area === "WHATSAPP" || signal.messageId) return "/whatsapp";
  if (signal.area === "FINANCE" || signal.chargeId) return "/finances?view=charges";
  if (signal.area === "GOVERNANCE" || signal.area === "RISK") return "/governance";
  if (signal.serviceOrderId) return `/service-orders?id=${signal.serviceOrderId}`;
  return "/timeline";
}

export default function ExecutiveDashboard() {
  const [assistedActionState, setAssistedActionState] = useState<Record<string, "idle" | "loading" | "success" | "error">>({});
  const [requestedAssistedActions, setRequestedAssistedActions] = useState<Record<string, true>>({});
  const [requestAssistedActionState, setRequestAssistedActionState] = useState<Record<string, "idle" | "loading" | "success" | "error">>({});
  const [cancelAssistedActionState, setCancelAssistedActionState] = useState<Record<string, "idle" | "loading" | "success" | "error">>({});
  const [recoverStuckState, setRecoverStuckState] = useState<Record<string, "idle" | "loading" | "success" | "error">>({});
  useRenderWatchdog("ExecutiveDashboard");
  const [location, navigate] = useLocation();
  const { runAction } = useRunAction();
  const dashboardKpisQuery = trpc.dashboard.kpis.useQuery(undefined, {
    retry: false,
  });
  const dashboardAlertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    retry: false,
  });
  const pendingWhatsAppApprovalsQuery =
    trpc.nexo.whatsapp.listPendingApprovals.useQuery(
      { limit: 10 },
      { retry: false }
    );
  const operationalSignalsQuery = useQuery({
    queryKey: ["internal-operational-signals"],
    queryFn: async () => {
      const response = await fetch("/internal/operational-signals?limit=8", { credentials: "include" });
      if (!response.ok) throw new Error("signals fetch failed");
      return (await response.json()) as { signals?: OperationalSignal[] };
    },
    retry: false,
  });
  const nextBestActionQuery = useQuery({
    queryKey: ["internal-operational-signals-next-best-action"],
    queryFn: async () => {
      const response = await fetch("/internal/operational-signals/next-best-action", { credentials: "include" });
      if (!response.ok) throw new Error("next best action fetch failed");
      return (await response.json()) as NextBestActionSignal | null;
    },
    retry: false,
  });

  const operationalActionsDiagnosticsQuery = useQuery({
    queryKey: ["internal-operational-actions-diagnostics"],
    queryFn: async () => {
      const response = await fetch("/internal/operational-actions/diagnostics", { credentials: "include" });
      if (response.status === 401 || response.status === 403) throw new Error("diagnostics forbidden");
      if (!response.ok) throw new Error("diagnostics fetch failed");
      return (await response.json()) as OperationalActionsDiagnostics;
    },
    retry: false,
  });

  const pendingWhatsAppApprovals = useMemo(() => {
    const data = Array.isArray(pendingWhatsAppApprovalsQuery.data)
      ? (pendingWhatsAppApprovalsQuery.data as WhatsAppActionExecution[])
      : [];
    return [...data].sort((a, b) => {
      const priorityWeight = (value?: string | null) => {
        const normalized = String(value ?? "").toUpperCase();
        if (normalized === "CRITICAL") return 4;
        if (normalized === "HIGH") return 3;
        if (normalized === "MEDIUM") return 2;
        return 1;
      };
      const priorityDelta =
        priorityWeight(b.conversation?.priority) -
        priorityWeight(a.conversation?.priority);
      if (priorityDelta !== 0) return priorityDelta;
      return (
        new Date(String(b.createdAt ?? 0)).getTime() -
        new Date(String(a.createdAt ?? 0)).getTime()
      );
    });
  }, [pendingWhatsAppApprovalsQuery.data]);

  const forcedState = useMemo(() => {
    if (typeof window === "undefined") return null;
    const stateParam = new URLSearchParams(window.location.search).get("state");
    if (
      stateParam === "healthy" ||
      stateParam === "alert" ||
      stateParam === "critical" ||
      stateParam === "empty" ||
      stateParam === "error" ||
      stateParam === "loading"
    ) {
      return stateParam;
    }
    return null;
  }, [location]);

  const metrics = useMemo(
    () => readDashboardRecord(dashboardKpisQuery.data),
    [dashboardKpisQuery.data]
  );
  const kpis = useMemo(() => buildKpis(metrics), [metrics]);
  const immediateAttention = useMemo(
    () =>
      normalizeAlerts(dashboardAlertsQuery.data)
        .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])
        .slice(0, 4),
    [dashboardAlertsQuery.data]
  );

  const criticalCount = immediateAttention.filter(
    item => item.severity === "critical"
  ).length;
  const computedState = resolveOperationalState(
    immediateAttention.length,
    criticalCount
  );
  const dashboardState: DashboardState = forcedState ?? computedState;

  const operationStateLabel =
    dashboardState === "empty"
      ? "Operação sem dados"
      : dashboardState === "error"
        ? "Falha de leitura operacional"
        : dashboardState === "loading"
          ? "Carregando operação"
          : normalizeOperationalState(dashboardState);

  const operationalSignals = (operationalSignalsQuery.data?.signals ?? []).slice(0, 5);
  const nextBestActionSignal = nextBestActionQuery.data;
  const nextBestAction = {
    id: nextBestActionSignal?.id ?? "next-best-action",
    action: nextBestActionQuery.data?.title ?? "Revisar sinais críticos da operação",
    reason: nextBestActionQuery.data?.reason ?? "Sinais críticos exigem priorização imediata.",
    impact: nextBestActionQuery.data?.impact ?? "Reduz risco operacional e melhora previsibilidade do turno.",
    ctaLabel: "Abrir contexto operacional",
    ctaPath:
      nextBestActionQuery.data?.actionType?.includes("WHATSAPP")
        ? "/whatsapp"
        : nextBestActionQuery.data?.actionType?.includes("CHARGE")
          ? "/finances?view=charges&status=overdue"
          : "/timeline",
  };
  const nextBestActionOperationalSignal: OperationalSignal | null = nextBestActionSignal
    ? {
      id: nextBestAction.id,
      severity: "CRITICAL",
      area: nextBestActionSignal.area ?? "OPERATIONS",
      title: nextBestAction.action,
      summary: nextBestAction.reason,
      impact: nextBestAction.impact,
      suggestedAction: nextBestActionSignal.suggestedAction,
      actionType: nextBestActionSignal.actionType,
      serviceOrderId: nextBestActionSignal.serviceOrderId ?? null,
      chargeId: nextBestActionSignal.chargeId ?? null,
      messageId: nextBestActionSignal.messageId ?? null,
      entityId: nextBestActionSignal.entityId ?? null,
    }
    : null;
  const runtimeIndicators = useMemo(() => ({
    whatsappFailures: operationalSignals.filter(item => item.area === "WHATSAPP" && item.severity !== "INFO").length,
    criticalCharges: operationalSignals.filter(item => item.area === "FINANCE" && item.severity === "CRITICAL").length,
    serviceOrderGaps: operationalSignals.filter(item => item.actionType === "CREATE_CHARGE_FOR_COMPLETED_OS").length,
    criticalDiagnostics: operationalSignals.filter(item => item.area === "DIAGNOSTICS" && item.severity === "CRITICAL").length,
    staleGovernance: operationalSignals.filter(item => item.area === "GOVERNANCE").length,
    elevatedRisk: operationalSignals.filter(item => item.area === "RISK").length,
  }), [operationalSignals]);
  const globalIntervention = useMemo(() => getPrimaryOperationalIntervention(detectOperationalInterventions({
    charges: operationalSignals.filter(item => item.area === "FINANCE").map(item => ({ status: item.severity === "CRITICAL" ? "OVERDUE" : "PENDING" })),
    serviceOrders: operationalSignals.filter(item => item.actionType === "CREATE_CHARGE_FOR_COMPLETED_OS").map(() => ({ status: "DONE" })),
    riskSummary: runtimeIndicators.elevatedRisk > 0 ? { level: "critical" } : null,
  })), [operationalSignals, runtimeIndicators.elevatedRisk]);

  const operationalHealth = runtimeIndicators.whatsappFailures + runtimeIndicators.staleGovernance + runtimeIndicators.elevatedRisk + runtimeIndicators.criticalDiagnostics + runtimeIndicators.criticalCharges >= 3
    ? "Estado crítico"
    : runtimeIndicators.whatsappFailures + runtimeIndicators.staleGovernance + runtimeIndicators.elevatedRisk > 0
      ? "Atenção necessária"
      : "Operação estável";


  const requestAssistedAction = async (signal: OperationalSignal) => {
    const entityId = resolveAssistedEntityId(signal);
    if (!signal.actionType || !entityId) return;
    setRequestAssistedActionState(prev => ({ ...prev, [signal.id]: "loading" }));
    try {
      const response = await fetch("/internal/operational-actions/request", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionType: signal.actionType,
          entityType: signal.area ?? "GENERAL",
          entityId,
          sourceSignalId: signal.id,
          metadata: {
            suggestedAction: signal.suggestedAction ?? null,
            relatedChargeId: signal.chargeId ?? null,
            relatedServiceOrderId: signal.serviceOrderId ?? null,
            relatedMessageId: signal.messageId ?? null,
          },
        }),
      });
      if (!response.ok) throw new Error("failed_request_assisted_action");
      setRequestAssistedActionState(prev => ({ ...prev, [signal.id]: "success" }));
      setRequestedAssistedActions(prev => ({ ...prev, [signal.id]: true }));
      void operationalSignalsQuery.refetch();
      void nextBestActionQuery.refetch();
    } catch {
      setRequestAssistedActionState(prev => ({ ...prev, [signal.id]: "error" }));
    }
  };

  const executeAssistedAction = async (signal: OperationalSignal) => {
    const entityId = resolveAssistedEntityId(signal);
    if (!signal.actionType || !entityId) return;
    setAssistedActionState(prev => ({ ...prev, [signal.id]: "loading" }));
    try {
      const response = await fetch("/internal/operational-actions/execute", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionType: signal.actionType,
          entityType: signal.area ?? "GENERAL",
          entityId,
          sourceSignalId: signal.id,
          metadata: {
            suggestedAction: signal.suggestedAction ?? null,
            relatedChargeId: signal.chargeId ?? null,
            relatedServiceOrderId: signal.serviceOrderId ?? null,
            relatedMessageId: signal.messageId ?? null,
          },
        }),
      });
      if (!response.ok) throw new Error("failed_execute_assisted_action");
      setAssistedActionState(prev => ({ ...prev, [signal.id]: "success" }));
      void operationalSignalsQuery.refetch();
      void nextBestActionQuery.refetch();
    } catch {
      setAssistedActionState(prev => ({ ...prev, [signal.id]: "error" }));
    }
  };



  const cancelAssistedAction = async (signal: OperationalSignal) => {
    const entityId = resolveAssistedEntityId(signal);
    if (!signal.actionType || !entityId) return;
    setCancelAssistedActionState(prev => ({ ...prev, [signal.id]: "loading" }));
    try {
      const response = await fetch("/internal/operational-actions/cancel", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionType: signal.actionType,
          entityType: signal.area ?? "GENERAL",
          entityId,
          sourceSignalId: signal.id,
          metadata: {
            suggestedAction: signal.suggestedAction ?? null,
            relatedChargeId: signal.chargeId ?? null,
            relatedServiceOrderId: signal.serviceOrderId ?? null,
            relatedMessageId: signal.messageId ?? null,
          },
        }),
      });
      if (!response.ok) throw new Error("failed_cancel_assisted_action");
      setCancelAssistedActionState(prev => ({ ...prev, [signal.id]: "success" }));
      setRequestedAssistedActions(prev => {
        const next = { ...prev };
        delete next[signal.id];
        return next;
      });
      setAssistedActionState(prev => ({ ...prev, [signal.id]: "idle" }));
      void operationalSignalsQuery.refetch();
      void nextBestActionQuery.refetch();
    } catch {
      setCancelAssistedActionState(prev => ({ ...prev, [signal.id]: "error" }));
    }
  };

  const recoverStuckExecution = async (executionId: string) => {
    if (!window.confirm('Confirmar recuperação manual desta EXECUTING travada?')) return
    setRecoverStuckState(prev => ({ ...prev, [executionId]: 'loading' }))
    try {
      const response = await fetch('/internal/operational-actions/recover-stuck', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ executionId, recoveryReason: 'manual_dashboard_recovery' }),
      })
      if (!response.ok) throw new Error('failed_recover_stuck')
      setRecoverStuckState(prev => ({ ...prev, [executionId]: 'success' }))
      void operationalActionsDiagnosticsQuery.refetch()
    } catch {
      setRecoverStuckState(prev => ({ ...prev, [executionId]: 'error' }))
    }
  }

  const queue = useMemo(() => {
    const whatsappItems: QueueItem[] = pendingWhatsAppApprovals
      .slice(0, 2)
      .map(execution => ({
        type: "Aprovação WhatsApp",
        entity: `${whatsappActionLabel(execution.suggestedAction)} · ${
          execution.conversation?.title ?? "Conversa WhatsApp"
        }`,
        status:
          execution.conversation?.priority === "CRITICAL"
            ? "Urgente"
            : "Pendente",
        deadline: `Criada em ${formatWhatsAppExecutionDate(execution.createdAt)}`,
        actionLabel: "Abrir com contexto",
        path: buildWhatsAppExecutionPath(execution),
      }));

    return [...whatsappItems, ...defaultQueue].slice(0, 5);
  }, [pendingWhatsAppApprovals]);

  const isPageLoading =
    dashboardState === "loading" ||
    (dashboardKpisQuery.isLoading && dashboardAlertsQuery.isLoading);
  const hasPageError =
    dashboardState === "error" ||
    (dashboardKpisQuery.isError && dashboardAlertsQuery.isError);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] executive-dashboard-command-center");
  }, []);

  return (
    <AppPageShell>
      <AppOperationalHeader
        title="Central de comando"
        description="Priorize risco, destrave fluxo e acompanhe a execução operacional de hoje."
        secondaryActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                aria-label="Ações secundárias do dashboard"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => navigate("/governance")}>
                Ver governança
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/timeline")}>
                Abrir timeline
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/whatsapp")}>
                Cockpit WhatsApp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        primaryAction={
          <Button
            onClick={() =>
              void runAction(async () =>
                navigate("/dashboard/operations?filter=critical")
              )
            }
          >
            Abrir fila prioritária
          </Button>
        }
        contextChips={
          <>
            <span className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
              {formatOperationalPeriod()}
            </span>
            <span className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
              Estado geral: {operationStateLabel}
            </span>
            <span className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
              Aprovações WhatsApp: {pendingWhatsAppApprovals.length}
            </span>
          </>
        }
      >
        <div className="grid gap-2 text-xs text-[var(--text-secondary)] md:grid-cols-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--dashboard-success)]" />
            Toda seção termina em ação operacional.
          </span>
          <span className="flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-[var(--dashboard-warning)]" />
            Alertas ordenados por impacto e urgência.
          </span>
          <span className="flex items-center gap-2">
            <ArrowRight className="h-3.5 w-3.5 text-[var(--dashboard-info)]" />
            Foco no fluxo Cliente → Pagamento.
          </span>
        </div>
      </AppOperationalHeader>

      {isPageLoading ? <AppPageLoadingState /> : null}
      {hasPageError ? (
        <AppPageErrorState
          description="Não foi possível carregar os sinais operacionais do Dashboard."
          actionLabel="Tentar novamente"
          onAction={() => {
            void dashboardKpisQuery.refetch();
            void dashboardAlertsQuery.refetch();
            void pendingWhatsAppApprovalsQuery.refetch();
            void operationalActionsDiagnosticsQuery.refetch();
          }}
        />
      ) : null}
      {dashboardState === "empty" ? (
        <AppPageEmptyState
          title="Operação sem dados suficientes"
          description="Comece por cadastrar cliente, criar agendamento, abrir O.S. e registrar cobrança para ativar o centro de decisão."
        />
      ) : null}

      {!isPageLoading && !hasPageError && dashboardState !== "empty" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <AppSectionBlock
            title={operationalCopy.immediateAttention}
            subtitle="Problemas que exigem ação agora; nenhum alerta fica sem destino."
            className="xl:col-span-8"
          >
            <div className="space-y-2.5">
              {immediateAttention.map(item => (
                <AttentionRow
                  key={`${item.severity}-${item.title}`}
                  item={item}
                  onNavigate={navigate}
                />
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title={operationalCopy.nextBestAction}
            subtitle="A decisão com maior efeito para o turno atual."
            className="xl:col-span-4"
          >
            <article className="rounded-lg border border-[var(--dashboard-danger)]/35 bg-[color-mix(in_srgb,var(--dashboard-danger)_8%,var(--surface-subtle))] p-4">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Prioridade #1
              </p>
              <p className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                {nextBestAction.action}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                Motivo: {nextBestAction.reason}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                Impacto esperado: {nextBestAction.impact}
              </p>
              <Button
                className="mt-4 w-full"
                size="sm"
                onClick={() => navigate(nextBestAction.ctaPath)}
              >
                {nextBestAction.ctaLabel}
              </Button>
              {nextBestActionOperationalSignal?.actionType && supportedAssistedActionTypes.has(nextBestActionOperationalSignal.actionType) ? (
                <div className="mt-2 space-y-2">
                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
                    onClick={() => void requestAssistedAction(nextBestActionOperationalSignal)}
                    disabled={assistedActionState[nextBestActionOperationalSignal.id] === "loading"}
                  >
                    Solicitar ação assistida
                  </Button>
                  {requestedAssistedActions[nextBestActionOperationalSignal.id] ? (
                    <>
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => void executeAssistedAction(nextBestActionOperationalSignal)}
                      disabled={assistedActionState[nextBestActionOperationalSignal.id] === "loading"}
                    >
                      {assistedActionState[nextBestActionOperationalSignal.id] === "loading" ? "Executando..." : "Executar ação assistida (confirmação explícita)"}
                    </Button>
                    <Button
                      className="w-full"
                      size="sm"
                      variant="ghost"
                      onClick={() => void cancelAssistedAction(nextBestActionOperationalSignal)}
                      disabled={cancelAssistedActionState[nextBestActionOperationalSignal.id] === "loading"}
                    >
                      {cancelAssistedActionState[nextBestActionOperationalSignal.id] === "loading" ? "Cancelando..." : "Cancelar ação assistida"}
                    </Button>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">Solicite a ação primeiro. A execução só ocorre por clique explícito.</p>
                  )}
                  {requestAssistedActionState[nextBestActionOperationalSignal.id] === "error" ? <p className="text-xs text-red-600">Falha ao solicitar ação assistida.</p> : null}
                  {requestAssistedActionState[nextBestActionOperationalSignal.id] === "success" ? <p className="text-xs text-emerald-600">Ação assistida solicitada (REQUESTED).</p> : null}
                  {cancelAssistedActionState[nextBestActionOperationalSignal.id] === "error" ? <p className="text-xs text-red-600">Falha ao cancelar ação assistida.</p> : null}
                  {cancelAssistedActionState[nextBestActionOperationalSignal.id] === "success" ? <p className="text-xs text-emerald-600">Ação assistida cancelada (CANCELED).</p> : null}
                  {assistedActionState[nextBestActionOperationalSignal.id] === "error" ? <p className="text-xs text-red-600">Falha ao executar ação assistida.</p> : null}
                  {assistedActionState[nextBestActionOperationalSignal.id] === "success" ? <p className="text-xs text-emerald-600">Ação assistida executada com sucesso.</p> : null}
                </div>
              ) : null}
            </article>
          </AppSectionBlock>
          <AppSectionBlock title="Saúde operacional" subtitle="Heurística simples e explicável baseada em criticidade ativa." className="xl:col-span-4">
            <article className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{operationalHealth}</p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">CRITICAL: {operationalSignals.filter(item => item.severity === "CRITICAL").length} · WARNING: {operationalSignals.filter(item => item.severity === "WARNING").length}</p>
            </article>
          </AppSectionBlock>

          <AppSectionBlock title="Executive runtime" subtitle="Leitura viva de degradação operacional." className="xl:col-span-8">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
              <AppStatCard label="WhatsApp falhando" value={String(runtimeIndicators.whatsappFailures)} helper="Mensagens com falha exigem revisão." />
              <AppStatCard label="Cobranças críticas" value={String(runtimeIndicators.criticalCharges)} helper="Pendências vencidas com maior impacto." />
              <AppStatCard label="O.S. sem cobrança" value={String(runtimeIndicators.serviceOrderGaps)} helper="Serviços concluídos sem fechamento financeiro." />
              <AppStatCard label="Diagnósticos críticos" value={String(runtimeIndicators.criticalDiagnostics)} helper="Incidentes com risco operacional." />
              <AppStatCard label="Governança stale" value={String(runtimeIndicators.staleGovernance)} helper="Itens sem atualização recente." />
              <AppStatCard label="Risco elevado" value={String(runtimeIndicators.elevatedRisk)} helper="Sinais de risco ativos no turno." />
            </div>
          </AppSectionBlock>


          <AppSectionBlock title="Saúde das ações assistidas" subtitle="Sinais compactos para destravar execução assistida." className="xl:col-span-12">
            {operationalActionsDiagnosticsQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <article key={idx} className="h-20 animate-pulse rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3" />
                ))}
              </div>
            ) : null}
            {operationalActionsDiagnosticsQuery.isError ? (
              <article className="rounded-lg border border-[var(--dashboard-danger)]/35 bg-[var(--surface-subtle)] p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Não foi possível carregar o diagnóstico.</p>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => void operationalActionsDiagnosticsQuery.refetch()}>Tentar novamente</Button>
              </article>
            ) : null}
            {operationalActionsDiagnosticsQuery.data ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <AppStatCard label="Pendentes" value={String(operationalActionsDiagnosticsQuery.data.pendingRequestedCount)} helper="REQUESTED aguardando execução." />
                  <AppStatCard label="Travadas" value={String(operationalActionsDiagnosticsQuery.data.stuckExecutingCount)} helper={operationalActionsDiagnosticsQuery.data.stuckExecutingCount > 0 ? "Há EXECUTING travadas; investigar agora." : "Sem ações travadas."} />
                  <AppStatCard label="Falhas 24h" value={String(operationalActionsDiagnosticsQuery.data.failedLast24hCount)} helper={operationalActionsDiagnosticsQuery.data.failedLast24hCount > 0 ? "Falhas recentes acima de zero." : "Nenhuma falha recente."} />
                  <AppStatCard label="Recuperadas 24h" value={String(operationalActionsDiagnosticsQuery.data.recoveredLast24hCount)} helper="EXECUTING travadas encerradas manualmente." />
                  <AppStatCard label="Tempo médio execução" value={formatDurationMs(operationalActionsDiagnosticsQuery.data.avgRequestedToExecutedMs)} helper="Média REQUESTED → EXECUTED." />
                </div>
                {(operationalActionsDiagnosticsQuery.data.stuckExecutingCount > 0 || operationalActionsDiagnosticsQuery.data.failedLast24hCount > 0) ? (
                  <p className="text-xs font-semibold text-[var(--dashboard-danger)]">Estado crítico: existem ações travadas ou falhas recentes.</p>
                ) : (
                  <p className="text-xs text-[var(--dashboard-success)]">Saudável: sem travas e sem falhas recentes relevantes.</p>
                )}
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                  <article className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Top falhas por tipo</p>
                      <Button size="sm" variant="ghost" onClick={() => void operationalActionsDiagnosticsQuery.refetch()}>Atualizar</Button>
                    </div>
                    {operationalActionsDiagnosticsQuery.data.topFailedActionTypes.length === 0 ? <p className="mt-2 text-xs text-[var(--text-secondary)]">Nenhuma falha recente.</p> : (
                      <ul className="mt-2 space-y-1.5 text-xs text-[var(--text-secondary)]">
                        {operationalActionsDiagnosticsQuery.data.topFailedActionTypes.slice(0, 3).map((item) => (
                          <li key={item.actionType} className="flex items-center justify-between gap-2"><span>{item.actionType}</span><span>{item.count}</span></li>
                        ))}
                      </ul>
                    )}
                  </article>
                  <article className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Últimas falhas</p>
                    {operationalActionsDiagnosticsQuery.data.recentFailures.length === 0 ? <p className="mt-2 text-xs text-[var(--text-secondary)]">Nenhuma falha recente.</p> : (
                      <ul className="mt-2 space-y-2 text-xs text-[var(--text-secondary)]">
                        {operationalActionsDiagnosticsQuery.data.recentFailures.slice(0, 3).map((failure) => (
                          <li key={failure.id}><p className="font-medium text-[var(--text-primary)]">{failure.actionType}</p><p>{formatFailureTime(failure.failedAt)} · {failure.failureReason ?? "Sem motivo informado"}</p></li>
                        ))}
                      </ul>
                    )}
                  </article>

                  <article className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">EXECUTING travadas</p>
                    {operationalActionsDiagnosticsQuery.data.recentStuckExecuting.length === 0 ? <p className="mt-2 text-xs text-[var(--text-secondary)]">Nenhuma execução travada.</p> : (
                      <ul className="mt-2 space-y-2 text-xs text-[var(--text-secondary)]">
                        {operationalActionsDiagnosticsQuery.data.recentStuckExecuting.slice(0, 3).map((execution) => (
                          <li key={execution.id}>
                            <p className="font-medium text-[var(--text-primary)]">{execution.actionType}</p>
                            <p>{execution.entityType} · {execution.entityId}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => void recoverStuckExecution(execution.id)} disabled={recoverStuckState[execution.id] === 'loading'}>
                                {recoverStuckState[execution.id] === 'loading' ? 'Recuperando...' : 'Marcar como recuperado'}
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                </div>
              </div>
            ) : null}
          </AppSectionBlock>

          <AppSectionBlock title="Operational Attention Center" subtitle="Top sinais reais para ação imediata" className="xl:col-span-12">
            {globalIntervention ? (
              <div className="mb-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Intervenção dominante global</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{globalIntervention.label}</p>
                <p className="text-xs text-[var(--text-secondary)]">{globalIntervention.summary}</p>
              </div>
            ) : null}
            {operationalSignals.length === 0 ? <p className="text-xs text-[var(--text-secondary)]">Sem sinais operacionais ativos no momento.</p> : null}
            <div className="space-y-2.5">
              {operationalSignals.map(signal => (
                <article key={signal.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <AppStatusBadge label={signal.severity} />
                        <AppStatusBadge label={signal.area} />
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{signal.title}</p>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{signal.summary ?? "Sinal operacional ativo."}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">Impacto: {signal.impact ?? "Impacto operacional em monitoramento."}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">Ação sugerida: {signal.suggestedAction ?? "Revisar no contexto operacional."}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(buildSignalCtaPath(signal))}>Abrir contexto</Button>
                      {signal.actionType && supportedAssistedActionTypes.has(signal.actionType) ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => void requestAssistedAction(signal)} disabled={requestAssistedActionState[signal.id] === "loading"}>
                            {requestAssistedActionState[signal.id] === "loading" ? "Solicitando..." : "Solicitar ação assistida"}
                          </Button>
                          {requestedAssistedActions[signal.id] ? (
                            <>
                            <Button size="sm" onClick={() => void executeAssistedAction(signal)} disabled={assistedActionState[signal.id] === "loading"}>
                              {assistedActionState[signal.id] === "loading" ? "Executando..." : "Executar ação assistida (confirmação explícita)"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void cancelAssistedAction(signal)} disabled={cancelAssistedActionState[signal.id] === "loading"}>
                              {cancelAssistedActionState[signal.id] === "loading" ? "Cancelando..." : "Cancelar ação assistida"}
                            </Button>
                            </>
                          ) : null}
                          {requestAssistedActionState[signal.id] === "error" ? <p className="text-xs text-red-600">Falha ao solicitar ação assistida.</p> : null}
                          {requestAssistedActionState[signal.id] === "success" ? <p className="text-xs text-emerald-600">Ação assistida solicitada (REQUESTED).</p> : null}
                          {cancelAssistedActionState[signal.id] === "error" ? <p className="text-xs text-red-600">Falha ao cancelar ação assistida.</p> : null}
                          {cancelAssistedActionState[signal.id] === "success" ? <p className="text-xs text-emerald-600">Ação assistida cancelada (CANCELED).</p> : null}
                          {assistedActionState[signal.id] === "error" ? <p className="text-xs text-red-600">Falha ao executar ação assistida.</p> : null}
                          {assistedActionState[signal.id] === "success" ? <p className="text-xs text-emerald-600">Ação assistida executada.</p> : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="KPIs operacionais"
            subtitle="Indicadores com contexto decisório e rota de investigação."
            className="xl:col-span-12"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {kpis.map(kpi => (
                <AppStatCard
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  helper={kpi.helper}
                  delta={
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(kpi.path)}
                    >
                      {kpi.actionLabel}
                    </Button>
                  }
                />
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Fluxo operacional"
            subtitle="Leitura contínua do caminho Cliente → Agendamento → O.S. → Cobrança → Pagamento."
            className="xl:col-span-12"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {operationalPipeline.map(step => (
                <article
                  key={step.stage}
                  className="flex min-h-[156px] flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">
                    {step.stage}
                  </p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <p className="text-3xl font-semibold leading-none text-[var(--text-primary)]">
                      {step.volume}
                    </p>
                    <span className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
                      {step.conversion}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
                    {step.microcontext}
                  </p>
                  <Button
                    size="sm"
                    className="mt-auto"
                    variant="outline"
                    onClick={() => navigate(step.path)}
                  >
                    {step.action}
                  </Button>
                </article>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              Gargalo principal: Cobrança → Pagamento. Ação sugerida: acelerar
              carteira vencida antes do fechamento.
            </p>
          </AppSectionBlock>

          <AppSectionBlock
            title="Fila operacional"
            subtitle="Itens executáveis, incluindo aprovações humanas sensíveis."
            className="xl:col-span-8"
          >
            {pendingWhatsAppApprovalsQuery.isError ? (
              <div className="mb-3 rounded-lg border border-rose-300/25 bg-rose-300/10 p-3 text-xs text-[var(--text-secondary)]">
                Não foi possível carregar aprovações WhatsApp no dashboard.
                <Button
                  className="ml-2 h-7 px-2 text-[10px]"
                  size="sm"
                  variant="outline"
                  onClick={() => void pendingWhatsAppApprovalsQuery.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : null}
            <div className="grid gap-2.5 lg:grid-cols-2">
              {queue.map(item => (
                <QueueRow
                  key={`${item.type}-${item.entity}`}
                  item={item}
                  onNavigate={navigate}
                />
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Pulso da operação"
            subtitle="Sinais interpretados para orientar supervisão no turno."
            className="xl:col-span-4"
          >
            <div className="space-y-2.5">
              {pulseSignals.map(signal => {
                const Icon = signal.icon;
                return (
                  <div
                    key={signal.text}
                    className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3"
                  >
                    <Icon className={`mt-0.5 h-4 w-4 ${signal.tone}`} />
                    <p className="text-xs leading-5 text-[var(--text-secondary)]">
                      {signal.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Acessos rápidos contextuais"
            subtitle="Atalhos para as telas que resolvem os gargalos mostrados acima."
            className="xl:col-span-12"
            compact
          >
            <div className="flex flex-wrap gap-2">
              {quickAccess.map(item => (
                <Button
                  key={item.path}
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(item.path)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </AppSectionBlock>
        </div>
      ) : null}
    </AppPageShell>
  );
}
