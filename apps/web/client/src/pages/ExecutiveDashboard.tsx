import { useMemo } from "react";
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  WalletCards,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import {
  AppContextChip,
  AppMetricCard,
  AppOperationalHeader,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppPriorityBadge,
  AppStatusBadge,
} from "@/components/internal-page-system";
import {
  EntityTimelineCard,
  NextBestActionCard,
  OperationalFlowCard,
  OperationalStateCard,
  type OperationalFlowStageState,
  type OperationalStateLevel,
} from "@/components/app";
import {
  buildWhatsAppExecutionPath,
  formatWhatsAppExecutionDate,
  whatsappActionLabel,
  type WhatsAppActionExecution,
} from "@/lib/whatsappActionExecution";

type DashboardRecord = Record<string, unknown>;
type Severity = "critical" | "high" | "medium";
type SignalSeverity = "CRITICAL" | "WARNING" | "INFO";
type OperationalSignal = {
  id: string;
  severity: SignalSeverity;
  area: string;
  title: string;
  summary?: string;
  impact?: string;
  suggestedAction?: string;
  serviceOrderId?: string | null;
  chargeId?: string | null;
  messageId?: string | null;
};
type NextBestActionSignal = OperationalSignal & { reason?: string };
type AttentionItem = {
  id: string;
  severity: Severity;
  title: string;
  reason: string;
  impact: string;
  ctaLabel: string;
  path: string;
};
type QueueItem = {
  id: string;
  type: string;
  entity: string;
  context: string;
  status: string;
  dueLabel: string;
  responsible: string;
  priority: Severity;
  ctaLabel: string;
  path: string;
};
type FlowStage = {
  id: string;
  label: string;
  value: string;
  context: string;
  path: string;
  action: string;
  state: OperationalFlowStageState;
};
type RecommendedAction = {
  title: string;
  entity: string;
  reason: string;
  impact: string;
  path: string;
  ctaLabel: string;
  safetyNote?: string;
};
type DashboardTimelineEvent = DashboardRecord & {
  id?: unknown;
  eventType?: unknown;
  type?: unknown;
  action?: unknown;
  createdAt?: unknown;
  occurredAt?: unknown;
  entityType?: unknown;
  entityId?: unknown;
  actorName?: unknown;
  responsibleName?: unknown;
  summary?: unknown;
  description?: unknown;
  title?: unknown;
};
type ComparisonKey =
  | "revenueReceivedPct"
  | "completedServiceOrdersPct"
  | "overdueChargesPct"
  | "failedMessagesPct";
type QueueRecord = DashboardRecord & {
  id?: unknown;
  responsibleName?: unknown;
  assigneeName?: unknown;
  ownerName?: unknown;
  type?: unknown;
  title?: unknown;
  context?: unknown;
  amountCents?: unknown;
  startsAt?: unknown;
  lastMessageAt?: unknown;
  serviceOrderId?: unknown;
  chargeId?: unknown;
  appointmentId?: unknown;
  messageId?: unknown;
};

type DashboardAlerts = {
  overdueOrders?: { count?: number; items?: DashboardRecord[] };
  overdueCharges?: {
    count?: number;
    totalAmountCents?: number;
    items?: DashboardRecord[];
  };
  todayServices?: { count?: number; items?: DashboardRecord[] };
  customersWithPending?: { count?: number; items?: DashboardRecord[] };
  doneOrdersWithoutCharge?: {
    count?: number;
    totalAmountCents?: number;
    items?: DashboardRecord[];
  };
  operationalQueue?: QueueRecord[];
};

/**
 * Fonte de dados do cockpit operacional:
 * - dashboard.kpis: volumes, comparação histórica, WhatsApp Signals e governança quando o BFF entregar.
 * - dashboard.alerts: alertas financeiros/O.S. e fila transversal leve.
 * - /internal/operational-signals: riscos operacionais e próxima melhor ação do motor existente.
 * - nexo.timeline.listByOrg: prova operacional recente; sem eventos, o dashboard declara ausência em vez de inventar tendência.
 * Tudo abaixo é cálculo de priorização no frontend, preservando contratos, rotas, API e Prisma.
 */
const fullWidthLayoutClass = "w-full min-w-0";
const dashboardSectionClass = fullWidthLayoutClass;

const severityWeight: Record<Severity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

function asRecord(value: unknown): DashboardRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DashboardRecord)
    : {};
}

function asAlerts(value: unknown): DashboardAlerts {
  return asRecord(value) as DashboardAlerts;
}

function readNumber(record: DashboardRecord, key: string) {
  return typeof record[key] === "number" && Number.isFinite(record[key])
    ? (record[key] as number)
    : 0;
}

function readNullableNumber(record: DashboardRecord, key: string) {
  return typeof record[key] === "number" && Number.isFinite(record[key])
    ? (record[key] as number)
    : null;
}
function readString(record: DashboardRecord, key: string) {
  return typeof record[key] === "string" ? (record[key] as string) : "";
}

function formatShortDateTime(value: unknown) {
  if (typeof value !== "string" && !(value instanceof Date))
    return "Prazo não informado";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Prazo não informado";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isGovernanceAttention(level: string) {
  return ["WARNING", "RESTRICTED", "SUSPENDED", "HIGH", "CRITICAL"].includes(
    level.toUpperCase()
  );
}

function describeComparison(
  label: string,
  value: number,
  lowerIsBetter = false
) {
  if (value === 0) return `${label}: estável em relação ao período anterior.`;

  const improved = lowerIsBetter ? value < 0 : value > 0;
  return `${label}: ${improved ? "melhorou" : "piorou"} ${Math.abs(value).toLocaleString("pt-BR")}% em relação ao período anterior.`;
}

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatCurrencyMentions(value: string) {
  return value.replace(/(\d+)\s+centavos\b/gi, (_, cents: string) =>
    formatCurrencyFromCents(Number(cents))
  );
}

function formatPeriod() {
  return `Hoje · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}`;
}

function readResponsible(record: DashboardRecord) {
  return (
    readString(record, "responsibleName") ||
    readString(record, "assigneeName") ||
    readString(record, "ownerName") ||
    "Responsável não informado"
  );
}

function normalizeOperationLevel(value: string): OperationalStateLevel | null {
  const normalized = value.toUpperCase();
  return ["NORMAL", "WARNING", "RESTRICTED", "SUSPENDED"].includes(normalized)
    ? (normalized as OperationalStateLevel)
    : null;
}

function formatEventDateTime(value: unknown) {
  if (typeof value !== "string" && !(value instanceof Date))
    return "Data não informada";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeTimelineEvents(payload: unknown) {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(asRecord(payload).items)
      ? (asRecord(payload).items as unknown[])
      : Array.isArray(asRecord(payload).events)
        ? (asRecord(payload).events as unknown[])
        : [];

  return source.slice(0, 3).map((raw, index) => {
    const event = asRecord(raw) as DashboardTimelineEvent;
    const type = String(
      event.eventType ?? event.type ?? event.action ?? "Evento oficial"
    ).replace(/_/g, " ");
    const entityType = String(event.entityType ?? "Entidade").replace(
      /_/g,
      " "
    );
    const entityId = event.entityId ? ` #${String(event.entityId)}` : "";
    return {
      id: String(event.id ?? `${type}-${index}`),
      type,
      occurredAt: formatEventDateTime(event.occurredAt ?? event.createdAt),
      entity: `${entityType}${entityId}`,
      actor:
        typeof event.actorName === "string"
          ? event.actorName
          : typeof event.responsibleName === "string"
            ? event.responsibleName
            : undefined,
      summary: formatCurrencyMentions(
        String(
          event.summary ??
            event.description ??
            event.title ??
            "Evento oficial registrado na Timeline."
        )
      ),
    };
  });
}

function buildSignalPath(
  signal: Pick<
    OperationalSignal,
    "area" | "messageId" | "chargeId" | "serviceOrderId"
  >
) {
  if (signal.area === "WHATSAPP" || signal.messageId) return "/whatsapp";
  if (signal.area === "FINANCE" || signal.chargeId)
    return "/finances?view=charges";
  if (signal.serviceOrderId)
    return `/service-orders?id=${signal.serviceOrderId}`;
  if (signal.area === "GOVERNANCE" || signal.area === "RISK")
    return "/governance";
  return "/timeline";
}

function fromSignal(signal: OperationalSignal): AttentionItem {
  return {
    id: signal.id,
    severity:
      signal.severity === "CRITICAL"
        ? "critical"
        : signal.severity === "WARNING"
          ? "high"
          : "medium",
    title: formatCurrencyMentions(signal.title),
    reason: formatCurrencyMentions(
      signal.summary ?? "Sinal operacional retornado pelo backend."
    ),
    impact: formatCurrencyMentions(
      signal.impact ?? "O impacto precisa ser validado no módulo responsável."
    ),
    ctaLabel: signal.suggestedAction ?? "Abrir contexto",
    path: buildSignalPath(signal),
  };
}

function buildAttention(
  alerts: DashboardAlerts,
  signals: OperationalSignal[],
  metrics: DashboardRecord
) {
  const items = signals.map(fromSignal);
  const add = (condition: number, item: Omit<AttentionItem, "id">) => {
    if (condition > 0)
      items.push({ id: `${item.path}-${item.title}`, ...item });
  };
  add(alerts.overdueOrders?.count ?? 0, {
    severity: "critical",
    title: "O.S. atrasadas exigem destravamento",
    reason: `${alerts.overdueOrders?.count} ordem(ns) passaram do prazo operacional.`,
    impact:
      "Atrasos ativos podem comprometer as próximas janelas de atendimento.",
    ctaLabel: "Revisar O.S. atrasadas",
    path: "/service-orders?status=attention",
  });
  add(alerts.overdueCharges?.count ?? 0, {
    severity: "critical",
    title: "Cobranças vencidas pressionam o caixa",
    reason: `${alerts.overdueCharges?.count} cobrança(s) vencida(s), somando ${formatCurrencyFromCents(alerts.overdueCharges?.totalAmountCents ?? 0)}.`,
    impact:
      "Recebimentos atrasados interrompem o fechamento financeiro do serviço.",
    ctaLabel: "Cobrar carteira vencida",
    path: "/finances?view=charges&status=overdue",
  });
  add(alerts.doneOrdersWithoutCharge?.count ?? 0, {
    severity: "high",
    title: "Serviços concluídos ainda não viraram cobrança",
    reason: `${alerts.doneOrdersWithoutCharge?.count} O.S. concluída(s) sem cobrança vinculada.`,
    impact: "Serviço entregue sem cobrança prolonga o ciclo até pagamento.",
    ctaLabel: "Fechar serviços concluídos",
    path: "/service-orders?status=done",
  });
  add(alerts.customersWithPending?.count ?? 0, {
    severity: "high",
    title: "Clientes com pendência financeira ativa",
    reason: `${alerts.customersWithPending?.count} cliente(s) possuem cobranças pendentes ou vencidas.`,
    impact: "Carteira sem contato aumenta risco de inadimplência e retrabalho.",
    ctaLabel: "Abrir carteira financeira",
    path: "/finances?view=charges",
  });

  const unconfirmedAppointments = (alerts.operationalQueue ?? []).filter(
    item => item.type === "UNCONFIRMED_APPOINTMENT"
  ).length;
  add(unconfirmedAppointments, {
    severity: "high",
    title: "Agendamentos sem confirmação",
    reason: `${unconfirmedAppointments} agendamento(s) nas próximas 48 horas ainda precisam confirmação.`,
    impact:
      "Agenda sem confirmação aumenta o risco de deslocamento perdido e O.S. parada.",
    ctaLabel: "Confirmar agenda",
    path: "/appointments?status=pending-confirmation",
  });

  const whatsappSignals = asRecord(metrics.whatsappSignals);
  const failedMessages = readNumber(whatsappSignals, "failedMessages");
  const customersNoResponse = readNumber(
    whatsappSignals,
    "customersNoResponse"
  );
  add(failedMessages, {
    severity: "high",
    title: "Mensagens WhatsApp com falha",
    reason: `${failedMessages} mensagem(ns) falharam no canal operacional.`,
    impact: "Confirmações, cobranças e retornos podem não chegar ao cliente.",
    ctaLabel: "Revisar WhatsApp",
    path: "/whatsapp",
  });
  add(customersNoResponse, {
    severity: "medium",
    title: "Clientes aguardando resposta",
    reason: `${customersNoResponse} conversa(s) estão aguardando operador.`,
    impact:
      "Tempo de resposta alto trava confirmação e continuidade do atendimento.",
    ctaLabel: "Responder conversas",
    path: "/whatsapp",
  });

  const governance = asRecord(metrics.governance);
  const governanceLevel = readString(governance, "level").toUpperCase();
  if (governanceLevel && isGovernanceAttention(governanceLevel)) {
    items.push({
      id: `governance-${governanceLevel}`,
      severity:
        governanceLevel === "SUSPENDED" || governanceLevel === "CRITICAL"
          ? "critical"
          : "high",
      title: `Governança em ${governanceLevel}`,
      reason: "O serviço de governança retornou sinal fora do nível normal.",
      impact:
        "Regras, limites ou restrições podem afetar ações assistidas e operação.",
      ctaLabel: "Ver governança",
      path: "/governance",
    });
  }

  return items
    .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])
    .slice(0, 5);
}

function buildQueue(alerts: DashboardAlerts): QueueItem[] {
  return (alerts.operationalQueue ?? []).slice(0, 10).map(item => {
    const type = String(item.type);
    if (type === "OVERDUE_SERVICE_ORDER")
      return {
        id: String(item.id),
        type: "O.S. atrasada",
        entity: String(item.title ?? "Ordem de serviço"),
        context: formatCurrencyMentions(
          String(item.context ?? "Prazo operacional vencido")
        ),
        status: "Prazo vencido",
        dueLabel: "Vencida",
        responsible: readResponsible(asRecord(item)),
        priority: "critical",
        ctaLabel: "Destravar",
        path: `/service-orders?id=${String(item.serviceOrderId ?? item.id)}`,
      };
    if (type === "OVERDUE_CHARGE") {
      const amount =
        typeof item.amountCents === "number" ? item.amountCents : 0;
      const amountLabel = formatCurrencyFromCents(amount);
      const context = formatCurrencyMentions(
        String(item.context ?? "Prazo financeiro vencido")
      )
        .replace(
          new RegExp(
            `${amountLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:-|·)?\\s*`,
            "i"
          ),
          ""
        )
        .replace(/^\s*(?:-|·)\s*/, "");
      return {
        id: String(item.id),
        type: "Cobrança vencida",
        entity: String(item.title ?? "Cliente"),
        context: `${amountLabel} pendentes${context ? ` · ${context}` : ""}`,
        status: "Vencida",
        dueLabel: "Financeiro vencido",
        responsible: readResponsible(asRecord(item)),
        priority: "critical",
        ctaLabel: "Cobrar",
        path: "/finances?view=charges&status=overdue",
      };
    }
    if (type === "CUSTOMER_AWAITING_RESPONSE")
      return {
        id: String(item.id),
        type: "Cliente aguardando resposta",
        entity: String(item.title ?? "Conversa WhatsApp"),
        context: formatCurrencyMentions(
          String(item.context ?? "Conversa aguardando resposta da operação")
        ),
        status: "Aguardando operador",
        dueLabel: formatShortDateTime(item.lastMessageAt),
        responsible: readResponsible(asRecord(item)),
        priority: "high",
        ctaLabel: "Responder cliente",
        path: "/whatsapp",
      };
    if (type === "UNCONFIRMED_APPOINTMENT")
      return {
        id: String(item.id),
        type: "Agendamento sem confirmação",
        entity: String(item.title ?? "Agendamento futuro"),
        context: formatCurrencyMentions(
          String(item.context ?? "Confirmação pendente")
        ),
        status: "Sem confirmação",
        dueLabel: formatShortDateTime(item.startsAt),
        responsible: readResponsible(asRecord(item)),
        priority: "high",
        ctaLabel: "Confirmar agenda",
        path: "/appointments",
      };
    return {
      id: String(item.id),
      type: "Mensagem com falha",
      entity: String(item.title ?? "Mensagem WhatsApp"),
      context: formatCurrencyMentions(
        String(item.context ?? "Falha retornada pelo backend")
      ),
      status: "Falha de envio",
      dueLabel: "Falha recente",
      responsible: readResponsible(asRecord(item)),
      priority: "high",
      ctaLabel: "Resolver mensagem",
      path: "/whatsapp",
    };
  });
}

function AttentionRow({
  item,
  navigate,
}: {
  item: AttentionItem;
  navigate: (path: string) => void;
}) {
  return (
    <article className="relative w-full min-w-0 py-3 pl-6 first:pt-0 last:pb-0">
      <ShieldAlert className="absolute left-0 top-3 h-4 w-4 text-[var(--danger)] first:top-0" />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AppStatusBadge
              label={
                item.severity === "critical"
                  ? "Risco crítico"
                  : item.severity === "high"
                    ? "Aguardando ação"
                    : "Monitorar"
              }
            />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {item.title}
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">Motivo:</strong>{" "}
            {item.reason}
          </p>
          <p className="text-xs leading-5 text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">Impacto:</strong>{" "}
            {item.impact}
          </p>
        </div>
        <Button
          className="w-full shrink-0 md:w-auto"
          size="sm"
          onClick={() => navigate(item.path)}
        >
          {item.ctaLabel}
        </Button>
      </div>
    </article>
  );
}

export default function ExecutiveDashboard() {
  useRenderWatchdog("ExecutiveDashboard");
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const kpisQuery = trpc.dashboard.kpis.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const pendingWhatsAppApprovalsQuery =
    trpc.nexo.whatsapp.listPendingApprovals.useQuery(
      { limit: 10 },
      { enabled: isAuthenticated, retry: false }
    );
  const operationalSignalsQuery = useQuery({
    queryKey: ["internal-operational-signals"],
    queryFn: async () => {
      const response = await fetch("/internal/operational-signals?limit=8", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("signals fetch failed");
      return (await response.json()) as { signals?: OperationalSignal[] };
    },
    enabled: isAuthenticated,
    retry: false,
  });
  const nextBestActionQuery = useQuery({
    queryKey: ["internal-operational-signals-next-best-action"],
    queryFn: async () => {
      const response = await fetch(
        "/internal/operational-signals/next-best-action",
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("next best action fetch failed");
      return (await response.json()) as NextBestActionSignal | null;
    },
    enabled: isAuthenticated,
    retry: false,
  });
  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery(
    { limit: 3 },
    { enabled: isAuthenticated, retry: false }
  );

  const metrics = useMemo(() => asRecord(kpisQuery.data), [kpisQuery.data]);
  const alerts = useMemo(() => asAlerts(alertsQuery.data), [alertsQuery.data]);
  const signals = operationalSignalsQuery.data?.signals ?? [];
  const attention = useMemo(
    () => buildAttention(alerts, signals, metrics),
    [alerts, signals, metrics]
  );
  const queue = useMemo(() => buildQueue(alerts), [alerts]);
  const pendingWhatsAppApprovals = Array.isArray(
    pendingWhatsAppApprovalsQuery.data
  )
    ? (pendingWhatsAppApprovalsQuery.data as WhatsAppActionExecution[])
    : [];
  const pageLoading = kpisQuery.isLoading || alertsQuery.isLoading;
  const pageError = kpisQuery.isError || alertsQuery.isError;
  const comparison = asRecord(metrics.comparison);
  const pulseComparisons: Array<[string, ComparisonKey, boolean?]> = [
    ["Receita recebida", "revenueReceivedPct"],
    ["O.S. concluídas", "completedServiceOrdersPct"],
    ["Cobranças vencidas", "overdueChargesPct", true],
    ["Mensagens falhando", "failedMessagesPct", true],
  ];
  const criticalCount = attention.filter(
    item => item.severity === "critical"
  ).length;
  const overdueOrders = alerts.overdueOrders?.count ?? 0;
  const overdueCharges = alerts.overdueCharges?.count ?? 0;
  const missingCharges = alerts.doneOrdersWithoutCharge?.count ?? 0;
  const timelineEvents = normalizeTimelineEvents(timelineQuery.data);
  const governance = asRecord(metrics.governance);
  const governanceLevel = normalizeOperationLevel(
    readString(governance, "level")
  );
  const operationLevel: OperationalStateLevel = pageError
    ? "SUSPENDED"
    : governanceLevel ??
      (criticalCount > 0
        ? "RESTRICTED"
        : attention.length > 0
          ? "WARNING"
          : "NORMAL");
  const operationStateFallback = governanceLevel
    ? "Estado retornado pela governança."
    : "Estado operacional não retornado pela fonte atual; nível derivado de alertas e sinais disponíveis.";

  const flow: FlowStage[] = [
    {
      id: "customers",
      label: "Cliente",
      value: String(readNumber(metrics, "totalCustomers")),
      context: "clientes ativos",
      path: "/customers",
      action: "Ver clientes",
      state: readNumber(metrics, "totalCustomers") > 0 ? "done" : "idle",
    },
    {
      id: "appointments",
      label: "Agendamento",
      value: String(alerts.todayServices?.count ?? 0),
      context: "agendamentos hoje",
      path: "/appointments",
      action: "Ver agenda",
      state: (alerts.todayServices?.count ?? 0) > 0 ? "active" : "idle",
    },
    {
      id: "service-orders",
      label: "O.S.",
      value: String(readNumber(metrics, "openServiceOrders")),
      context:
        overdueOrders > 0
          ? `${overdueOrders} atrasada(s) dentro das ordens abertas`
          : "ordens abertas",
      path: "/service-orders",
      action: "Ver execução",
      state:
        overdueOrders > 0
          ? "blocked"
          : readNumber(metrics, "openServiceOrders") > 0
            ? "active"
            : "idle",
    },
    {
      id: "charges",
      label: "Cobrança",
      value: String(readNumber(metrics, "chargesGenerated")),
      context:
        overdueCharges > 0
          ? `${overdueCharges} vencida(s) travando recebimento`
          : "cobranças geradas",
      path: "/finances?view=charges",
      action: "Ver cobranças",
      state:
        overdueCharges > 0
          ? "blocked"
          : missingCharges > 0
            ? "warning"
            : readNumber(metrics, "chargesGenerated") > 0
              ? "done"
              : "idle",
    },
    {
      id: "payments",
      label: "Pagamento",
      value:
        readNullableNumber(metrics, "paymentsReceivedCount") === null
          ? "—"
          : String(readNullableNumber(metrics, "paymentsReceivedCount")),
      context:
        readNullableNumber(metrics, "paymentsReceivedCount") === null
          ? "volume não disponível no contrato"
          : "pagamentos recebidos nesta semana",
      path: "/finances?view=paid",
      action: "Ver pagamentos",
      state:
        readNullableNumber(metrics, "paymentsReceivedCount") === null
          ? "idle"
          : "done",
    },
    {
      id: "timeline",
      label: "Timeline",
      value: timelineQuery.isError ? "!" : String(timelineEvents.length),
      context: timelineQuery.isError
        ? "leitura indisponível"
        : "eventos oficiais recentes",
      path: "/timeline",
      action: "Ver prova",
      state: timelineQuery.isError
        ? "warning"
        : timelineEvents.length > 0
          ? "done"
          : "idle",
    },
    {
      id: "governance",
      label: "Risco/Governança",
      value: operationLevel,
      context:
        criticalCount > 0
          ? `${criticalCount} risco(s) crítico(s)`
          : "sinal transversal consolidado",
      path: "/governance",
      action: "Ver governança",
      state:
        operationLevel === "SUSPENDED"
          ? "blocked"
          : operationLevel === "WARNING"
            ? "warning"
            : "done",
    },
  ];
  const bottleneck =
    overdueCharges >= overdueOrders &&
    overdueCharges >= missingCharges &&
    overdueCharges > 0
      ? {
          label: "Cobrança → Pagamento",
          action: "Priorizar cobranças vencidas",
          path: "/finances?view=charges&status=overdue",
        }
      : overdueOrders > 0
        ? {
            label: "Agendamento → O.S.",
            action: "Destravar O.S. atrasadas",
            path: "/service-orders?status=attention",
          }
        : missingCharges > 0
          ? {
              label: "O.S. → Cobrança",
              action: "Gerar cobranças pendentes",
              path: "/service-orders?status=done",
            }
          : null;
  const failedMessages = readNumber(
    asRecord(metrics.whatsappSignals),
    "failedMessages"
  );
  const nextBestAction = nextBestActionQuery.data;
  const highestValueOverdueCharge = (alerts.overdueCharges?.items ?? [])
    .slice()
    .sort(
      (a, b) =>
        readNumber(asRecord(b), "amountCents") -
        readNumber(asRecord(a), "amountCents")
    )[0];
  const highestValueChargeRecord = asRecord(highestValueOverdueCharge);
  const highestValueChargeCustomer = readString(
    asRecord(highestValueChargeRecord.customer),
    "name"
  );
  const firstQueueItem = queue[0];
  const fallbackAction: RecommendedAction | null = highestValueOverdueCharge
    ? {
        title: `Cobrar ${highestValueChargeCustomer || "cliente em atraso"} — ${formatCurrencyFromCents(readNumber(highestValueChargeRecord, "amountCents"))}`,
        entity: highestValueChargeCustomer || "Cobrança vencida",
        reason:
          "Maior cobrança vencida retornada pela leitura financeira atual.",
        impact:
          "Ação direta sobre o maior valor parado reduz pressão imediata no caixa.",
        path: "/finances?view=charges&status=overdue",
        ctaLabel: "Cobrar carteira vencida",
        safetyNote:
          "Fallback local baseado em alertas financeiros já carregados; não executa cobrança automática.",
      }
    : overdueOrders > 0
      ? {
          title:
            firstQueueItem?.type === "O.S. atrasada"
              ? `Destravar ${firstQueueItem.entity}`
              : "Revisar O.S. atrasadas",
          entity: firstQueueItem?.entity ?? "Ordens de serviço",
          reason: `${overdueOrders} O.S. atrasada(s) precisam avançar antes de novas janelas.`,
          impact:
            "Destravar a execução protege agenda, cliente e faturamento do serviço.",
          path:
            firstQueueItem?.type === "O.S. atrasada"
              ? firstQueueItem.path
              : "/service-orders?status=attention",
          ctaLabel: "Revisar O.S. atrasadas",
          safetyNote:
            "Fallback local baseado na fila operacional; não altera status sem ação do usuário.",
        }
      : firstQueueItem
        ? {
            title: `${firstQueueItem.ctaLabel} — ${firstQueueItem.entity}`,
            entity: firstQueueItem.entity,
            reason: `${firstQueueItem.type}: ${firstQueueItem.context}`,
            impact: `Responsável: ${firstQueueItem.responsible}. Status atual: ${firstQueueItem.status}.`,
            path: firstQueueItem.path,
            ctaLabel: firstQueueItem.ctaLabel,
            safetyNote:
              "Fallback local da fila operacional; abre o módulo responsável para validação.",
          }
        : failedMessages > 0
          ? {
              title: "Revisar WhatsApp",
              entity: "Canal WhatsApp",
              reason: `${failedMessages} mensagem(ns) com falha podem interromper o contato com clientes.`,
              impact:
                "Restabelecer a comunicação evita perda de confirmações e retornos.",
              path: "/whatsapp",
              ctaLabel: "Revisar WhatsApp",
              safetyNote:
                "Fallback local baseado em métricas de comunicação; abre WhatsApp sem enviar mensagens automaticamente.",
            }
          : null;
  const recommendedAction: RecommendedAction | null = nextBestAction
    ? {
        title: formatCurrencyMentions(nextBestAction.title),
        entity: nextBestAction.serviceOrderId
          ? `O.S. #${nextBestAction.serviceOrderId}`
          : nextBestAction.chargeId
            ? `Cobrança #${nextBestAction.chargeId}`
            : nextBestAction.messageId
              ? `Mensagem #${nextBestAction.messageId}`
              : nextBestAction.area || "Operação",
        reason: formatCurrencyMentions(
          nextBestAction.reason ??
            nextBestAction.summary ??
            "Prioridade indicada pelo motor operacional."
        ),
        impact: formatCurrencyMentions(
          nextBestAction.impact ??
            "Valide o impacto no módulo responsável antes de executar."
        ),
        path: buildSignalPath(nextBestAction),
        ctaLabel: nextBestAction.suggestedAction ?? "Abrir ação prioritária",
        safetyNote:
          "Sinal retornado pelo motor operacional; execução permanece no módulo de origem.",
      }
    : fallbackAction;
  const availableComparisons = pulseComparisons.flatMap(
    ([label, key, lowerIsBetter]) => {
      const value = readNullableNumber(comparison, key);
      return value === null
        ? []
        : [describeComparison(label, value, lowerIsBetter)];
    }
  );
  const missingComparisonCount =
    pulseComparisons.length - availableComparisons.length;
  const hasOperationalData =
    Object.keys(metrics).length > 0 || attention.length > 0 || queue.length > 0;
  const kpiCards = [
    {
      label: "Receita da semana",
      value: formatCurrencyFromCents(
        readNumber(metrics, "weeklyRevenueInCents")
      ),
      context: "Pagamentos registrados no período atual.",
      cta: "Ver pagamentos",
      path: "/finances?view=paid",
      Icon: WalletCards,
    },
    {
      label: "Execução em aberto",
      value: String(readNumber(metrics, "openServiceOrders")),
      context:
        overdueOrders > 0
          ? `${overdueOrders} atrasada(s) exigem avanço.`
          : "Sem atraso retornado.",
      cta: "Abrir execução",
      path: "/service-orders?status=open",
      Icon: ClipboardList,
    },
    {
      label: "Caixa em risco",
      value: formatCurrencyFromCents(
        alerts.overdueCharges?.totalAmountCents ?? 0
      ),
      context:
        overdueCharges > 0
          ? `${overdueCharges} cobrança(s) vencida(s).`
          : "Sem carteira vencida retornada.",
      cta: "Abrir cobranças",
      path: "/finances?view=charges&status=overdue",
      Icon: CircleDollarSign,
    },
    {
      label: "Falhas de comunicação",
      value: String(failedMessages),
      context:
        failedMessages > 0
          ? "Falhas podem bloquear confirmações."
          : "Sem falhas retornadas.",
      cta: "Revisar WhatsApp",
      path: "/whatsapp",
      Icon: MessageSquareWarning,
    },
  ];

  const quickAccesses = [
    {
      label: "Ver financeiro",
      path: "/finances?view=charges&status=overdue",
      Icon: CircleDollarSign,
    },
    {
      label: "Ver O.S.",
      path: "/service-orders?status=attention",
      Icon: ClipboardList,
    },
    {
      label: "Ver agendamentos",
      path: "/appointments?status=pending-confirmation",
      Icon: CalendarClock,
    },
    {
      label: "Ver WhatsApp",
      path: "/whatsapp",
      Icon: MessageSquareWarning,
    },
    {
      label: "Ver timeline",
      path: "/timeline",
      Icon: Clock3,
    },
    {
      label: "Ver governança",
      path: "/governance",
      Icon: ShieldCheck,
    },
  ];
  const pulseInsights = [
    {
      label: "Prioridade",
      Icon: ShieldAlert,
      iconClass: bottleneck
        ? "text-[var(--accent-primary)]"
        : "text-[var(--text-muted)]",
      text: bottleneck
        ? `${bottleneck.label} concentra a principal quebra do fluxo.`
        : "Pipeline sem quebra ativa; acompanhe a fila antes de redistribuir o time.",
    },
    {
      label: "Capacidade",
      Icon: Clock3,
      iconClass:
        overdueOrders > 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]",
      text:
        overdueOrders > 0
          ? `${overdueOrders} O.S. atrasada(s) indicam pressão na execução.`
          : "Execução sem atraso retornado; preserve o ritmo das próximas janelas.",
    },
    {
      label: "Contato",
      Icon: MessageSquareWarning,
      iconClass:
        failedMessages > 0
          ? "text-[var(--danger)]"
          : "text-[var(--text-muted)]",
      text:
        failedMessages > 0
          ? `${failedMessages} falha(s) podem quebrar confirmações e retorno ao cliente.`
          : "Nenhuma falha retornada; o canal não bloqueia o fluxo agora.",
    },
    {
      label: "Caixa",
      Icon: WalletCards,
      iconClass:
        overdueCharges > 0
          ? "text-[var(--accent-primary)]"
          : "text-[var(--text-muted)]",
      text:
        overdueCharges > 0
          ? `${formatCurrencyFromCents(alerts.overdueCharges?.totalAmountCents ?? 0)} vencidos prolongam o ciclo até recebimento.`
          : "Sem vencimentos retornados; caixa não exige reação imediata.",
    },
  ];
  const statusLabel =
    operationLevel === "NORMAL"
      ? "NORMAL"
      : operationLevel === "WARNING"
        ? "WARNING"
        : operationLevel === "RESTRICTED"
          ? "RESTRICTED"
          : "SUSPENDED";
  return (
    <AppPageShell className="gap-3 sm:gap-4">
      <AppOperationalHeader
        density="compact"
        title="Operação hoje"
        description="Decida primeiro o que destrava execução e caixa."
        contextChips={
          <>
            <AppContextChip>{formatPeriod()}</AppContextChip>
            <AppContextChip>Período: Hoje / Semana / 30 dias</AppContextChip>
            <AppContextChip
              tone={operationLevel === "NORMAL" ? "success" : "accent"}
            >
              Estado: {statusLabel}
            </AppContextChip>
            <AppContextChip tone={criticalCount > 0 ? "danger" : "neutral"}>
              {criticalCount}{" "}
              {criticalCount === 1 ? "risco crítico" : "riscos críticos"}
            </AppContextChip>
            <AppContextChip tone={overdueCharges > 0 ? "warning" : "neutral"}>
              {overdueCharges} cobranças vencidas
            </AppContextChip>
            <AppContextChip tone={overdueOrders > 0 ? "warning" : "neutral"}>
              {overdueOrders} O.S. atrasadas
            </AppContextChip>
            <AppContextChip tone={bottleneck ? "warning" : "neutral"}>
              Gargalo: {bottleneck?.label ?? "sem gargalo calculável"}
            </AppContextChip>
          </>
        }
      />

      {pageLoading ? (
        <AppPageLoadingState
          title="Carregando mesa de comando"
          description="Buscando riscos, fila e indicadores operacionais reais."
        />
      ) : null}
      {pageError ? (
        <AppPageErrorState
          title="Não foi possível ler a operação"
          description="Falhou a consulta de métricas ou alertas. A operação não assume que está tudo bem quando a leitura está indisponível."
          onAction={() => {
            void kpisQuery.refetch();
            void alertsQuery.refetch();
          }}
        />
      ) : null}
      {!pageLoading && !pageError && !hasOperationalData ? (
        <AppPageEmptyState
          title="Ainda não há dados operacionais para priorizar"
          description="Cadastre clientes, agendamentos, O.S. e cobranças. A operação não cria alertas ou recomendações fictícias para preencher este espaço."
        />
      ) : null}

      {!pageLoading && !pageError && hasOperationalData ? (
        <div className="w-full min-w-0 space-y-3 sm:space-y-4">
          <div className="grid w-full min-w-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <OperationalStateCard
              level={operationLevel}
              title="Estado operacional"
              reason={attention[0]?.reason ?? operationStateFallback}
              impact={
                attention[0]?.impact ??
                "Fluxo sem bloqueio crítico retornado; acompanhe fila e Timeline."
              }
              detailsLabel={attention[0]?.ctaLabel ?? "Abrir governança"}
              onDetails={() => navigate(attention[0]?.path ?? "/governance")}
            />

            <EntityTimelineCard
              events={timelineEvents}
              fullTimelineLabel="Ver Timeline"
              onFullTimeline={() => navigate("/timeline")}
            />
          </div>

          <AppSectionBlock
            title="Atenção imediata"
            compact
            className="border-[var(--danger)]/30 bg-[var(--surface-base)]"
            subtitle="Riscos que interrompem execução, recebimento ou atendimento."
          >
            {attention.length > 0 ? (
              <div className="w-full min-w-0 divide-y divide-[var(--border-subtle)]/70">
                {attention.map(item => (
                  <AttentionRow
                    key={item.id}
                    item={item}
                    navigate={navigate}
                  />
                ))}
              </div>
            ) : (
              <AppPageEmptyState
                title="Nenhum alerta operacional retornado"
                description="A leitura foi concluída sem riscos ativos. Continue acompanhando a fila operacional."
              />
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Próxima melhor ação"
            compact
            className={dashboardSectionClass}
            subtitle="Ação contextual mais importante retornada pelos sinais operacionais."
          >
            {recommendedAction ? (
              <NextBestActionCard
                title={recommendedAction.title}
                entity={recommendedAction.entity}
                reason={recommendedAction.reason}
                impact={recommendedAction.impact}
                safetyNote={recommendedAction.safetyNote}
                primaryActionLabel={recommendedAction.ctaLabel}
                onPrimaryAction={() => navigate(recommendedAction.path)}
                secondaryActionLabel={
                  nextBestActionQuery.isError ? "Tentar novamente" : undefined
                }
                onSecondaryAction={
                  nextBestActionQuery.isError
                    ? () => void nextBestActionQuery.refetch()
                    : undefined
                }
              />
            ) : (
              <AppPageEmptyState
                title="Nenhuma Próxima Melhor Ação disponível"
                description="A leitura atual não identificou urgências acionáveis; nenhuma ação artificial foi criada."
              />
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="KPIs operacionais"
            compact
            className={dashboardSectionClass}
            subtitle="Indicadores de apoio para decidir rápido."
          >
            <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {kpiCards.map(({ label, value, context, cta, path, Icon }) => (
                <AppMetricCard
                  key={label}
                  title={label}
                  value={value}
                  hint={context}
                  icon={<Icon className="h-4 w-4" />}
                  ctaLabel={cta}
                  onClick={() => navigate(path)}
                />
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Fluxo operacional"
            compact
            className={dashboardSectionClass}
            subtitle="Gargalos do fluxo Cliente → Agendamento → O.S. → Cobrança → Pagamento."
          >
            <OperationalFlowCard
              title="Gargalos operacionais"
              subtitle="Use os pontos de quebra para direcionar a próxima ação sem duplicar diagnósticos das páginas específicas."
              stages={flow.map(stage => ({
                id: stage.id,
                label: stage.label,
                summary: stage.context,
                state: stage.state,
                countOrValue: stage.value,
                hrefLabel: stage.action,
                onClick: () => navigate(stage.path),
              }))}
            />
          </AppSectionBlock>

          <AppSectionBlock
            title="Fila operacional"
            compact
            className={dashboardSectionClass}
            subtitle="Pendências curtas para destravar agora."
          >
            {queue.length > 0 ? (
              <div className="w-full min-w-0">
                <div className="max-h-[340px] w-full min-w-0 overflow-auto rounded-xl border border-[var(--border-subtle)]/70 p-2">
                  <div className="grid min-w-0 gap-2 text-xs">
                    {queue.slice(0, 10).map(item => (
                      <article
                        key={`${item.type}-${item.id}`}
                        className="grid min-w-0 gap-2 rounded-xl border border-[var(--border-subtle)]/60 bg-[var(--surface-primary)]/35 p-2.5 text-[var(--text-secondary)] md:grid-cols-[1.1fr_1.6fr_0.9fr_0.9fr_1fr_auto] md:items-center"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <AppPriorityBadge label={item.priority} />
                          <span className="truncate font-semibold text-[var(--text-primary)]">
                            {item.type}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <strong className="block truncate text-sm text-[var(--text-primary)]">
                            {item.entity}
                          </strong>
                          <span className="block truncate">{item.context}</span>
                        </span>
                        <span className="font-medium text-[var(--text-primary)]">
                          {item.status}
                        </span>
                        <span>{item.dueLabel}</span>
                        <span>{item.responsible}</span>
                        <Button
                          className="h-8 justify-self-start px-3 text-xs md:justify-self-end"
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(item.path)}
                        >
                          {item.ctaLabel}
                        </Button>
                      </article>
                    ))}
                  </div>
                </div>
                <Button
                  className="mt-2 h-auto px-0 py-0 text-[var(--accent-primary)]"
                  variant="link"
                  size="sm"
                  onClick={() => navigate("/timeline")}
                >
                  Abrir Timeline
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <AppPageEmptyState
                title="Fila operacional sem itens retornados"
                description="Não há itens acionáveis na leitura atual. A operação não preenche a fila com exemplos."
              />
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Pulso da operação"
            compact
            className={dashboardSectionClass}
            subtitle="Interpretação dos sinais para orientar a decisão."
          >
            <div className="flex w-full min-w-0 flex-col divide-y divide-[var(--border-subtle)]/70 lg:flex-row lg:divide-x lg:divide-y-0">
              {pulseInsights.map(({ label, Icon, iconClass, text }) => (
                <article
                  key={label}
                  className="w-full min-w-0 px-3 py-3 text-sm leading-5 text-[var(--text-secondary)] first:pt-0 lg:flex-1 lg:first:pt-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-subtle)]/70 bg-[var(--surface-elevated)]/65">
                      <Icon className={`h-4 w-4 ${iconClass}`} />
                    </span>
                    <strong className="text-[var(--text-primary)]">
                      {label}
                    </strong>
                  </div>
                  <p>{text}</p>
                </article>
              ))}
            </div>
            {availableComparisons.length > 0 || missingComparisonCount > 0 ? (
              <div className="mt-3 border-t border-[var(--border-subtle)]/70 pt-2 text-xs leading-5 text-[var(--text-secondary)]">
                {availableComparisons.map(item => (
                  <p key={item}>
                    <TrendingDown className="mr-1.5 inline h-3.5 w-3.5" />
                    {item}
                  </p>
                ))}
                {missingComparisonCount > 0 ? (
                  <p className="mt-1">
                    Histórico em formação: sem base histórica suficiente para{" "}
                    {missingComparisonCount} de {pulseComparisons.length}{" "}
                    indicador(es).
                  </p>
                ) : null}
              </div>
            ) : null}
          </AppSectionBlock>

          <AppSectionBlock
            title="Acessos rápidos contextuais"
            compact
            className={fullWidthLayoutClass}
            subtitle="Atalhos secundários da operação."
          >
            <div className="flex w-full min-w-0 flex-wrap gap-2">
              {quickAccesses.map(({ label, path, Icon }) => (
                <button
                  type="button"
                  key={path}
                  className="flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-primary)]/45 px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)]/30 hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                  onClick={() => navigate(path)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                    <span>{label}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
                </button>
              ))}
            </div>
            <div className="mt-3 w-full min-w-0 border-t border-[var(--border-subtle)]/70 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Aprovações WhatsApp · {pendingWhatsAppApprovals.length}
                </p>
                {pendingWhatsAppApprovals.length > 0 ? (
                  <Button
                    className="h-auto px-0 py-0 text-[var(--accent-primary)]"
                    variant="link"
                    size="sm"
                    onClick={() => navigate("/whatsapp")}
                  >
                    Abrir aprovações
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
              {pendingWhatsAppApprovalsQuery.isError ? (
                <p className="mt-2 text-xs text-[var(--danger)]">
                  Não foi possível carregar aprovações WhatsApp nesta leitura.
                </p>
              ) : pendingWhatsAppApprovals.length > 0 ? (
                <div className="mt-1 divide-y divide-[var(--border-subtle)]/70">
                  {pendingWhatsAppApprovals.slice(0, 2).map(execution => (
                    <button
                      type="button"
                      key={execution.id}
                      className="flex w-full items-center justify-between gap-3 py-2 text-left text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                      onClick={() =>
                        navigate(buildWhatsAppExecutionPath(execution))
                      }
                    >
                      <span>
                        {whatsappActionLabel(execution.suggestedAction)} ·{" "}
                        {formatWhatsAppExecutionDate(execution.createdAt)}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  Nenhuma aprovação pendente retornada. Sem prova operacional recente retornada quando a Timeline não trouxer eventos.
                </p>
              )}
            </div>
          </AppSectionBlock>
        </div>
      ) : null}
    </AppPageShell>
  );
}
