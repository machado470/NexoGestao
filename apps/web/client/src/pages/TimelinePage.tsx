import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  Download,
  FileClock,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppNextActionCard,
  AppOperationalHeader,
  AppPagination,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPriorityBadge,
  AppSectionBlock,
  AppStatusBadge,
  AppSkeleton,
} from "@/components/internal-page-system";
import {
  AppPageShell,
  AppSelect,
  AppStatCard,
  AppTimeline,
  AppTimelineItem,
} from "@/components/app-system";
import { Button } from "@/components/design-system";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { setBootPhase } from "@/lib/bootPhase";

type TimelineEvent = Record<string, any>;
type ModuleFilter =
  | "all"
  | "finance"
  | "service_order"
  | "appointment"
  | "whatsapp"
  | "governance"
  | "customer";
type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";

const PAGE_SIZE = 12;
const LIST_PAGE_SIZE = 8;

const MODULE_OPTIONS: Array<{ value: ModuleFilter; label: string }> = [
  { value: "all", label: "Todos os módulos" },
  { value: "finance", label: "Financeiro" },
  { value: "service_order", label: "O.S." },
  { value: "appointment", label: "Agendamentos" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "governance", label: "Governança" },
  { value: "customer", label: "Clientes" },
];

function text(value: unknown, fallback = "—") {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : fallback;
}

function eventAction(event: TimelineEvent) {
  return text(event?.action ?? event?.type, "EVENTO").toUpperCase();
}

function whatsappExecutionEventLabel(action: string) {
  const labels: Record<string, string> = {
    WHATSAPP_ACTION_APPROVED: "WhatsApp: ação aprovada",
    WHATSAPP_ACTION_EXECUTED: "WhatsApp: ação executada",
    WHATSAPP_ACTION_FAILED: "WhatsApp: ação falhou",
    WHATSAPP_ACTION_CANCELLED: "WhatsApp: ação cancelada",
  };
  return labels[action] ?? action.replace(/_/g, " ");
}

function eventDisplayTitle(event: TimelineEvent) {
  return whatsappExecutionEventLabel(eventAction(event));
}

function isWhatsAppExecutionEvent(action: string) {
  return [
    "WHATSAPP_ACTION_APPROVED",
    "WHATSAPP_ACTION_EXECUTED",
    "WHATSAPP_ACTION_FAILED",
    "WHATSAPP_ACTION_CANCELLED",
  ].includes(action);
}

function eventEntityLabel(event: TimelineEvent) {
  if (event?.customerId) return "Cliente";
  if (event?.serviceOrderId) return "Ordem de serviço";
  if (event?.appointmentId) return "Agendamento";
  if (event?.chargeId) return "Cobrança";
  const metadata = (event?.metadata ?? {}) as Record<string, unknown>;
  return text(metadata.entityType, "Operação");
}

function eventEntityId(event: TimelineEvent) {
  const metadata = (event?.metadata ?? {}) as Record<string, unknown>;
  return (
    text(event?.customerId, "") ||
    text(event?.serviceOrderId, "") ||
    text(event?.appointmentId, "") ||
    text(event?.chargeId, "") ||
    text(metadata.entityId, "") ||
    "—"
  );
}

function eventCustomerId(event: TimelineEvent) {
  const metadata = (event?.metadata ?? {}) as Record<string, unknown>;
  return text(event?.customerId ?? metadata.customerId, "");
}

function eventModule(event: TimelineEvent): ModuleFilter {
  const bucket = [
    text(event?.action, "").toLowerCase(),
    text(event?.description, "").toLowerCase(),
    text(event?.serviceOrderId, "").toLowerCase(),
    text(event?.appointmentId, "").toLowerCase(),
    text(event?.chargeId, "").toLowerCase(),
    text((event?.metadata ?? {})?.module, "").toLowerCase(),
  ].join(" ");

  if (
    event?.chargeId ||
    bucket.includes("payment") ||
    bucket.includes("charge") ||
    bucket.includes("finance")
  )
    return "finance";
  if (
    event?.serviceOrderId ||
    bucket.includes("service_order") ||
    bucket.includes("service order") ||
    bucket.includes("o.s")
  )
    return "service_order";
  if (
    event?.appointmentId ||
    bucket.includes("appointment") ||
    bucket.includes("agenda")
  )
    return "appointment";
  if (
    bucket.includes("whatsapp") ||
    bucket.includes("message") ||
    bucket.includes("comunica")
  )
    return "whatsapp";
  if (bucket.includes("govern") || bucket.includes("operational_state"))
    return "governance";
  if (
    event?.customerId ||
    bucket.includes("customer") ||
    bucket.includes("cliente")
  )
    return "customer";
  return "all";
}

function eventSeverity(event: TimelineEvent): Exclude<SeverityFilter, "all"> {
  const bucket = [
    text(event?.action, "").toLowerCase(),
    text(event?.description, "").toLowerCase(),
    text(event?.status, "").toLowerCase(),
  ].join(" ");
  if (
    isWhatsAppExecutionEvent(eventAction(event)) &&
    eventAction(event).includes("EXECUTED")
  )
    return "medium";
  if (
    bucket.includes("failed") ||
    bucket.includes("error") ||
    bucket.includes("cancel") ||
    bucket.includes("atras")
  )
    return "critical";
  if (
    bucket.includes("risk") ||
    bucket.includes("overdue") ||
    bucket.includes("warning") ||
    bucket.includes("block")
  )
    return "high";
  if (
    bucket.includes("confirm") ||
    bucket.includes("updated") ||
    bucket.includes("state")
  )
    return "medium";
  return "low";
}

function eventReason(event: TimelineEvent) {
  const description = text(event?.description, "");
  if (description) return description;
  const action = eventAction(event);
  if (action === "WHATSAPP_ACTION_APPROVED")
    return "Ação WhatsApp sensível aprovada por humano e liberada para execução segura.";
  if (action === "WHATSAPP_ACTION_EXECUTED")
    return "Ação WhatsApp executada pelo workflow com rastreabilidade operacional.";
  if (action === "WHATSAPP_ACTION_FAILED")
    return "Falha na execução do workflow WhatsApp; exige diagnóstico antes de nova tentativa.";
  if (action === "WHATSAPP_ACTION_CANCELLED")
    return "Workflow WhatsApp cancelado com decisão operacional registrada.";
  if (action.includes("CREATED"))
    return "Registro criado para iniciar fluxo operacional auditável.";
  if (action.includes("COMPLETED") || action.includes("DONE"))
    return "Execução concluída com rastreabilidade preservada.";
  if (action.includes("CANCELED") || action.includes("NO_SHOW"))
    return "Ruptura operacional registrada para análise imediata de risco.";
  if (action.includes("OPERATIONAL_STATE_CHANGED"))
    return "Mudança de estado operacional registrada em governança.";
  return "Evento registrado na memória oficial da operação.";
}

function eventRoute(event: TimelineEvent) {
  if (event?.customerId) return "/customers";
  if (event?.appointmentId) return "/appointments";
  if (event?.serviceOrderId) return "/service-orders";
  if (event?.chargeId) return "/finances";
  const module = eventModule(event);
  if (module === "whatsapp") return "/whatsapp";
  if (module === "governance") return "/governance";
  if (module === "finance") return "/finances";
  if (module === "service_order") return "/service-orders";
  if (module === "appointment") return "/appointments";
  if (module === "customer") return "/customers";
  return "/dashboard";
}

function EventIcon({
  module,
  severity,
}: {
  module: ModuleFilter;
  severity: Exclude<SeverityFilter, "all">;
}) {
  if (severity === "critical")
    return <Siren className="h-4 w-4 text-rose-400" />;
  if (module === "finance")
    return <BadgeDollarSign className="h-4 w-4 text-emerald-400" />;
  if (module === "appointment")
    return <CalendarClock className="h-4 w-4 text-sky-400" />;
  if (module === "whatsapp")
    return <MessageSquare className="h-4 w-4 text-teal-400" />;
  if (module === "governance")
    return <ShieldCheck className="h-4 w-4 text-violet-400" />;
  if (module === "service_order")
    return <FileClock className="h-4 w-4 text-amber-400" />;
  return <CheckCircle2 className="h-4 w-4 text-[var(--text-muted)]" />;
}

function formatDateTime(input: unknown) {
  if (!input) return "Sem data";
  const parsed = new Date(String(input));
  if (Number.isNaN(parsed.getTime())) return "Sem data";
  return parsed.toLocaleString("pt-BR");
}

export default function TimelinePage() {
  setBootPhase("PAGE:Timeline");
  useRenderWatchdog("TimelinePage");
  const [, navigate] = useLocation();

  const urlParams = useMemo(
    () => new URLSearchParams(window.location.search),
    []
  );
  const initialModule = (urlParams.get("module") ?? "all") as ModuleFilter;
  const initialCustomer = urlParams.get("customerId") ?? "all";

  const [searchValue, setSearchValue] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("7d");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>(
    MODULE_OPTIONS.some(option => option.value === initialModule)
      ? initialModule
      : "all"
  );
  const [entityFilter, setEntityFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState(initialCustomer);
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery(
    { limit: PAGE_SIZE, cursor },
    { retry: false }
  );

  useEffect(() => {
    if (!timelineQuery.data) return;
    const incoming = normalizeArrayPayload<TimelineEvent>(timelineQuery.data);
    setHasMore(incoming.length === PAGE_SIZE);
    setEvents(prev => {
      if (!cursor) return incoming;
      const seen = new Set(prev.map(item => String(item?.id ?? "")));
      const merged = [...prev];
      incoming.forEach(item => {
        const key = String(item?.id ?? "");
        if (key && !seen.has(key)) merged.push(item);
      });
      return merged;
    });
  }, [cursor, timelineQuery.data]);

  const isInitialLoading = timelineQuery.isLoading && events.length === 0;
  const hasInitialError = Boolean(timelineQuery.error) && events.length === 0;

  usePageDiagnostics({
    page: "timeline",
    isLoading: isInitialLoading,
    hasError: hasInitialError,
    isEmpty: !isInitialLoading && !hasInitialError && events.length === 0,
    dataCount: events.length,
  });

  const eventTypeOptions = useMemo(() => {
    const values = Array.from(new Set(events.map(event => eventAction(event))));
    return values
      .slice(0, 30)
      .map(value => ({ value, label: whatsappExecutionEventLabel(value) }));
  }, [events]);

  const entityOptions = useMemo(() => {
    const values = Array.from(
      new Set(events.map(event => eventEntityLabel(event)))
    );
    return values
      .slice(0, 20)
      .map(value => ({ value: value.toLowerCase(), label: value }));
  }, [events]);

  const clientOptions = useMemo(() => {
    const values = Array.from(
      new Set(events.map(event => eventCustomerId(event)).filter(Boolean))
    );
    return values
      .slice(0, 30)
      .map(value => ({ value, label: `Cliente #${value}` }));
  }, [events]);

  const responsibleOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        events.map(event =>
          text(event?.personName ?? event?.actorName, "Sistema")
        )
      )
    );
    return values
      .slice(0, 20)
      .map(value => ({ value: value.toLowerCase(), label: value }));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = searchValue.trim().toLowerCase();

    return events.filter(event => {
      const createdAt = new Date(String(event?.createdAt ?? ""));
      const hasDate = !Number.isNaN(createdAt.getTime());
      const action = eventAction(event);
      const entity = eventEntityLabel(event);
      const module = eventModule(event);
      const customerId = eventCustomerId(event);
      const responsible = text(
        event?.personName ?? event?.actorName,
        "Sistema"
      );
      const severity = eventSeverity(event);

      if (eventTypeFilter !== "all" && action !== eventTypeFilter) return false;
      if (moduleFilter !== "all" && module !== moduleFilter) return false;
      if (entityFilter !== "all" && entity.toLowerCase() !== entityFilter)
        return false;
      if (clientFilter !== "all" && customerId !== clientFilter) return false;
      if (
        responsibleFilter !== "all" &&
        responsible.toLowerCase() !== responsibleFilter
      )
        return false;
      if (severityFilter !== "all" && severity !== severityFilter) return false;

      if (
        periodFilter === "24h" &&
        (!hasDate || Date.now() - createdAt.getTime() > 24 * 60 * 60 * 1000)
      )
        return false;
      if (
        periodFilter === "7d" &&
        (!hasDate || Date.now() - createdAt.getTime() > 7 * 24 * 60 * 60 * 1000)
      )
        return false;
      if (
        periodFilter === "30d" &&
        (!hasDate ||
          Date.now() - createdAt.getTime() > 30 * 24 * 60 * 60 * 1000)
      )
        return false;

      if (!q) return true;
      const haystack = [
        action,
        text(event?.description, ""),
        entity,
        eventEntityId(event),
        customerId,
        responsible,
        module,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [
    clientFilter,
    entityFilter,
    eventTypeFilter,
    events,
    moduleFilter,
    periodFilter,
    responsibleFilter,
    searchValue,
    severityFilter,
  ]);
  const paginatedFilteredEvents = useMemo(() => {
    const start = (currentPage - 1) * LIST_PAGE_SIZE;
    return filteredEvents.slice(start, start + LIST_PAGE_SIZE);
  }, [currentPage, filteredEvents]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    clientFilter,
    entityFilter,
    eventTypeFilter,
    moduleFilter,
    periodFilter,
    responsibleFilter,
    searchValue,
    severityFilter,
  ]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredEvents.length / LIST_PAGE_SIZE)
    );
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, filteredEvents.length]);

  const selectedEvent = useMemo(
    () =>
      filteredEvents.find(event => String(event?.id) === selectedEventId) ??
      filteredEvents[0] ??
      null,
    [filteredEvents, selectedEventId]
  );

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, TimelineEvent[]>();
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    paginatedFilteredEvents.forEach(event => {
      const date = new Date(String(event?.createdAt ?? ""));
      let key = "Sem data";
      if (!Number.isNaN(date.getTime())) {
        const day = date.toDateString();
        key =
          day === today.toDateString()
            ? "Hoje"
            : day === yesterday.toDateString()
              ? "Ontem"
              : date.toLocaleDateString("pt-BR");
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(event);
    });

    return Array.from(groups.entries());
  }, [paginatedFilteredEvents]);

  const summary = useMemo(() => {
    const critical = filteredEvents.filter(
      item => eventSeverity(item) === "critical"
    ).length;
    const payments = filteredEvents.filter(item =>
      eventAction(item).includes("PAYMENT_RECEIVED")
    ).length;
    const opStateChanges = filteredEvents.filter(item =>
      eventAction(item).includes("OPERATIONAL_STATE_CHANGED")
    ).length;
    const failedMessaging = filteredEvents.filter(item => {
      const bucket =
        `${eventAction(item)} ${text(item?.description, "")}`.toLowerCase();
      return (
        eventModule(item) === "whatsapp" &&
        (bucket.includes("failed") || bucket.includes("erro"))
      );
    }).length;

    return { critical, payments, opStateChanges, failedMessaging };
  }, [filteredEvents]);

  const immediateAttention = useMemo(() => {
    return filteredEvents
      .filter(item => eventSeverity(item) === "critical")
      .slice(0, 3)
      .map(item => ({
        id: String(item?.id ?? ""),
        title: eventDisplayTitle(item),
        context: `${eventEntityLabel(item)} #${eventEntityId(item)} · ${formatDateTime(
          item?.createdAt
        )}`,
        impact:
          eventModule(item) === "finance"
            ? "Impacto financeiro imediato no caixa e na previsibilidade."
            : eventModule(item) === "whatsapp"
              ? "Risco de quebra de comunicação e perda de resposta operacional."
              : "Risco de escalada operacional que exige investigação rastreável.",
        route: eventRoute(item),
      }));
  }, [filteredEvents]);

  const nextAction = useMemo(() => {
    const groupedByCustomer = new Map<
      string,
      {
        customerId: string;
        score: number;
        reasons: string[];
        lastEvent: TimelineEvent;
      }
    >();

    filteredEvents.forEach(event => {
      const customerId = eventCustomerId(event);
      if (!customerId) return;
      const action = eventAction(event);
      const detail = text(event?.description, "").toLowerCase();
      let score = 0;
      const reasons: string[] = [];

      if (eventSeverity(event) === "critical") {
        score += 4;
        reasons.push("evento crítico");
      }
      if (
        action.includes("PAYMENT") ||
        action.includes("CHARGE") ||
        detail.includes("atras")
      ) {
        score += 3;
        reasons.push("sinal financeiro");
      }
      if (
        action.includes("WHATSAPP") ||
        detail.includes("mensag") ||
        detail.includes("contato")
      ) {
        score += 2;
        reasons.push("falha de contato");
      }
      if (action.includes("CANCELED") || action.includes("NO_SHOW")) {
        score += 2;
        reasons.push("ruptura de execução");
      }

      if (score <= 0) return;
      const existing = groupedByCustomer.get(customerId);
      if (!existing) {
        groupedByCustomer.set(customerId, {
          customerId,
          score,
          reasons,
          lastEvent: event,
        });
        return;
      }

      existing.score += score;
      existing.reasons.push(...reasons);
      if (
        new Date(String(event?.createdAt ?? 0)).getTime() >
        new Date(String(existing.lastEvent?.createdAt ?? 0)).getTime()
      ) {
        existing.lastEvent = event;
      }
    });

    const candidate = Array.from(groupedByCustomer.values()).sort(
      (a, b) => b.score - a.score
    )[0];
    if (!candidate) return null;

    return {
      customerId: candidate.customerId,
      title: `Investigar cliente #${candidate.customerId}`,
      description: `Motivo: ${Array.from(new Set(candidate.reasons)).slice(0, 3).join(" + ")}. Evento mais recente em ${formatDateTime(candidate.lastEvent?.createdAt)}.`,
      impact:
        "Impacto: risco operacional crescente com possível efeito em receita, execução e governança.",
      route: "/customers",
      score: candidate.score,
    };
  }, [filteredEvents]);

  function loadMore() {
    const last = events[events.length - 1];
    if (!last?.id) return;
    setCursor(`${String(last.createdAt)}_${String(last.id)}`);
  }

  function clearFilters() {
    setSearchValue("");
    setEventTypeFilter("all");
    setModuleFilter("all");
    setEntityFilter("all");
    setClientFilter("all");
    setResponsibleFilter("all");
    setSeverityFilter("all");
    setPeriodFilter("7d");
  }

  function exportCsv() {
    const headers = [
      "tipo",
      "descricao",
      "entidade",
      "entidade_id",
      "cliente",
      "responsavel",
      "modulo",
      "criticidade",
      "data_hora",
    ];

    const rows = filteredEvents.map(item => [
      eventAction(item),
      text(eventReason(item), ""),
      eventEntityLabel(item),
      eventEntityId(item),
      eventCustomerId(item),
      text(item?.personName ?? item?.actorName, "Sistema"),
      eventModule(item),
      eventSeverity(item),
      formatDateTime(item?.createdAt),
    ]);

    const content = [headers, ...rows]
      .map(cols =>
        cols.map(col => `"${String(col).split('"').join('""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `timeline-operacional-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageWrapper
      title="Timeline"
      subtitle="Acompanhe o histórico oficial da operação."
    >
      <AppPageShell className="space-y-4">
        <AppOperationalHeader
          title="Timeline"
          description="Histórico oficial para auditoria, memória operacional, diagnóstico e governança."
          primaryAction={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportCsv}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Exportar
            </Button>
          }
          secondaryActions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPeriodFilter("24h")}
                className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                  periodFilter === "24h"
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                    : "border-[var(--border-subtle)]"
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter("7d")}
                className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                  periodFilter === "7d"
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                    : "border-[var(--border-subtle)]"
                }`}
              >
                7 dias
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter("30d")}
                className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                  periodFilter === "30d"
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-white"
                    : "border-[var(--border-subtle)]"
                }`}
              >
                30 dias
              </button>
            </div>
          }
        />

        <div className="grid gap-3 lg:grid-cols-3">
          <AppSectionBlock
            title="Atenção imediata"
            subtitle="Até 3 sinais críticos para ação imediata."
            className="lg:col-span-2"
          >
            {immediateAttention.length === 0 ? (
              <AppPageEmptyState
                title="Sem alerta crítico no recorte"
                description="A operação está estável neste período. Mantenha monitoramento ativo."
              />
            ) : (
              <div className="grid gap-2 md:grid-cols-3">
                {immediateAttention.map(alert => (
                  <article
                    key={alert.id}
                    className="rounded-xl border border-rose-500/35 bg-rose-500/5 p-3"
                  >
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {alert.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {alert.context}
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      {alert.impact}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setSelectedEventId(alert.id);
                        navigate(alert.route);
                      }}
                    >
                      Investigar agora
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Próxima melhor ação"
            subtitle="Recomendação contextual para reduzir risco operacional."
          >
            {nextAction ? (
              <AppNextActionCard
                title={nextAction.title}
                description={`${nextAction.description} ${nextAction.impact}`}
                severity={
                  nextAction.score >= 11
                    ? "critical"
                    : nextAction.score >= 7
                      ? "high"
                      : "medium"
                }
                metadata="Timeline oficial"
                action={{
                  label: "Abrir histórico",
                  onClick: () => navigate(nextAction.route),
                }}
              />
            ) : (
              <AppPageEmptyState
                title="Sem recomendação crítica"
                description="Nenhuma sequência de risco detectada agora."
              />
            )}
          </AppSectionBlock>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AppStatCard
            label="Eventos hoje"
            value={
              filteredEvents.filter(item => {
                const date = new Date(String(item?.createdAt ?? ""));
                return (
                  !Number.isNaN(date.getTime()) &&
                  date.toDateString() === new Date().toDateString()
                );
              }).length
            }
            helper="Volume do dia"
          />
          <AppStatCard
            label="Eventos críticos"
            value={summary.critical}
            helper="Exigem resposta"
          />
          <AppStatCard
            label="Pagamentos recebidos"
            value={summary.payments}
            helper="Sinal financeiro"
          />
          <AppStatCard
            label="Mudanças de estado"
            value={summary.opStateChanges}
            helper="Governança operacional"
          />
        </div>

        <AppSectionBlock
          title="Filtros de auditoria"
          subtitle="Refine por tipo, cliente, módulo, criticidade e ator."
        >
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={searchValue}
              onChange={event => setSearchValue(event.target.value)}
              placeholder="Buscar evento, entidade, responsável ou contexto"
              className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm"
            />
            <AppSelect
              value={eventTypeFilter}
              onValueChange={setEventTypeFilter}
              options={[
                { value: "all", label: "Tipo de evento" },
                ...eventTypeOptions,
              ]}
            />
            <AppSelect
              value={moduleFilter}
              onValueChange={value => setModuleFilter(value as ModuleFilter)}
              options={MODULE_OPTIONS}
            />
            <AppSelect
              value={severityFilter}
              onValueChange={value =>
                setSeverityFilter(value as SeverityFilter)
              }
              options={[
                { value: "all", label: "Criticidade" },
                { value: "critical", label: "Crítico" },
                { value: "high", label: "Alta" },
                { value: "medium", label: "Média" },
                { value: "low", label: "Baixa" },
              ]}
            />
            <AppSelect
              value={clientFilter}
              onValueChange={setClientFilter}
              options={[{ value: "all", label: "Cliente" }, ...clientOptions]}
            />
            <AppSelect
              value={entityFilter}
              onValueChange={setEntityFilter}
              options={[{ value: "all", label: "Entidade" }, ...entityOptions]}
            />
            <AppSelect
              value={responsibleFilter}
              onValueChange={setResponsibleFilter}
              options={[
                { value: "all", label: "Ator (usuário/sistema)" },
                ...responsibleOptions,
              ]}
            />
            <AppSelect
              value={periodFilter}
              onValueChange={setPeriodFilter}
              options={[
                { value: "24h", label: "Últimas 24h" },
                { value: "7d", label: "Últimos 7 dias" },
                { value: "30d", label: "Últimos 30 dias" },
                { value: "all", label: "Período total" },
              ]}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearFilters}
            >
              Limpar filtros
            </Button>
            <span className="text-xs text-[var(--text-muted)]">
              {filteredEvents.length} evento(s) no recorte atual.
            </span>
          </div>
        </AppSectionBlock>

        <div className="grid gap-3 xl:grid-cols-12">
          <AppSectionBlock
            title="Timeline oficial da operação"
            subtitle="Eventos curtos, auditáveis e com prioridade visual por criticidade."
            className="xl:col-span-8"
          >
            {isInitialLoading ? (
              <div className="space-y-2">
                <AppPageLoadingState
                  title="Carregando memória oficial"
                  description="Organizando histórico com rastreabilidade por entidade, ator e motivo."
                />
                <AppSkeleton className="h-20" />
                <AppSkeleton className="h-20" />
              </div>
            ) : hasInitialError ? (
              <AppPageErrorState
                description={
                  timelineQuery.error?.message ?? "Falha ao carregar timeline."
                }
                actionLabel="Tentar novamente"
                onAction={() => void timelineQuery.refetch()}
              />
            ) : filteredEvents.length === 0 ? (
              <AppPageEmptyState
                title="Sem eventos para este recorte"
                description="Ajuste os filtros para investigar outra janela operacional."
              />
            ) : (
              <div className="space-y-4">
                {groupedEvents.map(([dateLabel, dayEvents]) => (
                  <section key={dateLabel} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      {dateLabel}
                    </p>
                    <AppTimeline>
                      {dayEvents.map(event => {
                        const module = eventModule(event);
                        const severity = eventSeverity(event);
                        const isSelected =
                          String(event?.id) === String(selectedEvent?.id ?? "");

                        return (
                          <AppTimelineItem
                            key={String(
                              event?.id ??
                                `${eventEntityId(event)}-${event?.createdAt}`
                            )}
                            className={`cursor-pointer border ${
                              isSelected
                                ? "border-[var(--accent-primary)]/40 bg-[var(--accent-soft)]/25"
                                : severity === "critical"
                                  ? "border-rose-500/35 bg-rose-500/5"
                                  : "border-[var(--border-subtle)] bg-[var(--surface-base)]/70"
                            }`}
                            onClick={() =>
                              setSelectedEventId(String(event?.id))
                            }
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <EventIcon
                                    module={module}
                                    severity={severity}
                                  />
                                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                    {eventDisplayTitle(event)}
                                  </p>
                                </div>
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                  {eventReason(event)}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <AppPriorityBadge label={severity} />
                                <AppStatusBadge
                                  label={
                                    MODULE_OPTIONS.find(
                                      option => option.value === module
                                    )?.label ?? "Operação"
                                  }
                                />
                              </div>
                            </div>

                            <div className="mt-2 grid gap-1 text-xs text-[var(--text-muted)] md:grid-cols-2">
                              <p>
                                Entidade: {eventEntityLabel(event)} #
                                {eventEntityId(event)}
                              </p>
                              <p>
                                Quem:{" "}
                                {text(
                                  event?.personName ?? event?.actorName,
                                  "Sistema"
                                )}
                              </p>
                              <p>Quando: {formatDateTime(event?.createdAt)}</p>
                              <p>Por quê: {eventReason(event)}</p>
                            </div>
                          </AppTimelineItem>
                        );
                      })}
                    </AppTimeline>
                  </section>
                ))}

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)]">
                    Exibindo lote de ingestão {PAGE_SIZE} evento(s).
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadMore}
                    disabled={!hasMore || timelineQuery.isFetching}
                  >
                    {timelineQuery.isFetching
                      ? "Carregando..."
                      : hasMore
                        ? `Carregar mais ${PAGE_SIZE}`
                        : "Sem mais eventos"}
                  </Button>
                </div>
                <AppPagination
                  currentPage={currentPage}
                  totalItems={filteredEvents.length}
                  pageSize={LIST_PAGE_SIZE}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Contexto do evento"
            subtitle="Estrutura pronta para expansão do detalhe com links e próximos passos."
            className="xl:col-span-4"
          >
            {!selectedEvent ? (
              <AppPageEmptyState
                title="Selecione um evento"
                description="Clique em um item da timeline para abrir diagnóstico, metadados e ação."
              />
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Detalhes
                  </p>
                  <p className="mt-1 font-semibold text-[var(--text-primary)]">
                    {eventDisplayTitle(selectedEvent)}
                  </p>
                  <p className="mt-1 text-[var(--text-secondary)]">
                    {eventReason(selectedEvent)}
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Metadados e vínculo
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <li>
                      Entidade: {eventEntityLabel(selectedEvent)} #
                      {eventEntityId(selectedEvent)}
                    </li>
                    <li>
                      Responsável:{" "}
                      {text(
                        selectedEvent?.personName ?? selectedEvent?.actorName,
                        "Sistema"
                      )}
                    </li>
                    <li>
                      Data/hora: {formatDateTime(selectedEvent?.createdAt)}
                    </li>
                    <li>
                      Módulo:{" "}
                      {MODULE_OPTIONS.find(
                        option => option.value === eventModule(selectedEvent)
                      )?.label ?? "Operação"}
                    </li>
                    <li>
                      Cliente:{" "}
                      {eventCustomerId(selectedEvent)
                        ? `#${eventCustomerId(selectedEvent)}`
                        : "Não vinculado"}
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    Diagnóstico de risco
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AppStatusBadge
                      label={
                        eventSeverity(selectedEvent) === "critical"
                          ? "Em risco"
                          : "Monitorado"
                      }
                    />
                    {eventModule(selectedEvent) === "governance" ? (
                      <ShieldAlert className="h-4 w-4 text-violet-400" />
                    ) : null}
                    {eventModule(selectedEvent) === "finance" ? (
                      <BadgeDollarSign className="h-4 w-4 text-emerald-400" />
                    ) : null}
                    {eventSeverity(selectedEvent) === "critical" ? (
                      <AlertTriangle className="h-4 w-4 text-rose-400" />
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/customers")}
                  >
                    Abrir cliente
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/service-orders")}
                  >
                    Abrir O.S.
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/appointments")}
                  >
                    Abrir agendamento
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/finances")}
                  >
                    Abrir cobrança/financeiro
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(eventRoute(selectedEvent))}
                  >
                    Abrir contexto principal{" "}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </AppSectionBlock>
        </div>
      </AppPageShell>
    </PageWrapper>
  );
}
