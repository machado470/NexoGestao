import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  FileClock,
  Link2,
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
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppPriorityBadge,
  AppSectionBlock,
  AppStatusBadge,
  AppSkeleton,
} from "@/components/internal-page-system";
import {
  AppPageShell,
  AppSectionCard,
  AppSelect,
  AppTimeline,
  AppTimelineItem,
  AppToolbar,
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
type ModeFilter = "global" | "customer" | "entity" | "module";

const PAGE_SIZE = 12;

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
  if (event?.appointmentId || bucket.includes("appointment") || bucket.includes("agenda"))
    return "appointment";
  if (bucket.includes("whatsapp") || bucket.includes("message") || bucket.includes("comunica"))
    return "whatsapp";
  if (bucket.includes("govern") || bucket.includes("operational_state")) return "governance";
  if (event?.customerId || bucket.includes("customer") || bucket.includes("cliente")) return "customer";
  return "all";
}

function eventSeverity(event: TimelineEvent): Exclude<SeverityFilter, "all"> {
  const bucket = [
    text(event?.action, "").toLowerCase(),
    text(event?.description, "").toLowerCase(),
    text(event?.status, "").toLowerCase(),
  ].join(" ");
  if (bucket.includes("failed") || bucket.includes("error") || bucket.includes("cancel") || bucket.includes("atras"))
    return "critical";
  if (bucket.includes("risk") || bucket.includes("overdue") || bucket.includes("warning") || bucket.includes("block"))
    return "high";
  if (bucket.includes("confirm") || bucket.includes("updated") || bucket.includes("state")) return "medium";
  return "low";
}

function eventReason(event: TimelineEvent) {
  const description = text(event?.description, "");
  if (description) return description;
  const action = eventAction(event);
  if (action.includes("CREATED")) return "Registro criado para iniciar fluxo operacional auditável.";
  if (action.includes("COMPLETED") || action.includes("DONE")) return "Execução concluída com rastreabilidade preservada.";
  if (action.includes("CANCELED") || action.includes("NO_SHOW"))
    return "Ruptura operacional registrada para análise imediata de risco.";
  if (action.includes("OPERATIONAL_STATE_CHANGED")) return "Mudança de estado operacional registrada em governança.";
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

function EventIcon({ module, severity }: { module: ModuleFilter; severity: Exclude<SeverityFilter, "all"> }) {
  if (severity === "critical") return <Siren className="h-4 w-4 text-rose-400" />;
  if (module === "finance") return <BadgeDollarSign className="h-4 w-4 text-emerald-400" />;
  if (module === "appointment") return <CalendarClock className="h-4 w-4 text-sky-400" />;
  if (module === "whatsapp") return <MessageSquare className="h-4 w-4 text-teal-400" />;
  if (module === "governance") return <ShieldCheck className="h-4 w-4 text-violet-400" />;
  if (module === "service_order") return <FileClock className="h-4 w-4 text-amber-400" />;
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

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialModule = (urlParams.get("module") ?? "all") as ModuleFilter;
  const initialCustomer = urlParams.get("customerId") ?? "all";

  const [searchValue, setSearchValue] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("7d");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>(
    MODULE_OPTIONS.some(option => option.value === initialModule) ? initialModule : "all"
  );
  const [entityFilter, setEntityFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState(initialCustomer);
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("global");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery({ limit: PAGE_SIZE, cursor }, { retry: false });

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
    return values.slice(0, 30).map(value => ({ value, label: value.replace(/_/g, " ") }));
  }, [events]);

  const entityOptions = useMemo(() => {
    const values = Array.from(new Set(events.map(event => eventEntityLabel(event))));
    return values.slice(0, 20).map(value => ({ value: value.toLowerCase(), label: value }));
  }, [events]);

  const clientOptions = useMemo(() => {
    const values = Array.from(new Set(events.map(event => eventCustomerId(event)).filter(Boolean)));
    return values.slice(0, 30).map(value => ({ value, label: `Cliente #${value}` }));
  }, [events]);

  const responsibleOptions = useMemo(() => {
    const values = Array.from(new Set(events.map(event => text(event?.personName ?? event?.actorName, "Sistema"))));
    return values.slice(0, 20).map(value => ({ value: value.toLowerCase(), label: value }));
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
      const responsible = text(event?.personName ?? event?.actorName, "Sistema");
      const severity = eventSeverity(event);

      if (eventTypeFilter !== "all" && action !== eventTypeFilter) return false;
      if (moduleFilter !== "all" && module !== moduleFilter) return false;
      if (entityFilter !== "all" && entity.toLowerCase() !== entityFilter) return false;
      if (clientFilter !== "all" && customerId !== clientFilter) return false;
      if (responsibleFilter !== "all" && responsible.toLowerCase() !== responsibleFilter) return false;
      if (severityFilter !== "all" && severity !== severityFilter) return false;

      if (periodFilter === "24h" && (!hasDate || Date.now() - createdAt.getTime() > 24 * 60 * 60 * 1000)) return false;
      if (periodFilter === "7d" && (!hasDate || Date.now() - createdAt.getTime() > 7 * 24 * 60 * 60 * 1000)) return false;
      if (periodFilter === "30d" && (!hasDate || Date.now() - createdAt.getTime() > 30 * 24 * 60 * 60 * 1000)) return false;

      if (modeFilter === "customer" && !customerId) return false;
      if (modeFilter === "entity" && eventEntityId(event) === "—") return false;
      if (modeFilter === "module" && module === "all") return false;

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
    modeFilter,
    moduleFilter,
    periodFilter,
    responsibleFilter,
    searchValue,
    severityFilter,
  ]);

  const selectedEvent = useMemo(
    () => filteredEvents.find(event => String(event?.id) === selectedEventId) ?? filteredEvents[0] ?? null,
    [filteredEvents, selectedEventId]
  );

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, TimelineEvent[]>();
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    filteredEvents.forEach(event => {
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
  }, [filteredEvents]);

  const summary = useMemo(() => {
    const critical = filteredEvents.filter(item => eventSeverity(item) === "critical").length;
    const failedMessaging = filteredEvents.filter(item => {
      const bucket = `${eventAction(item)} ${text(item?.description, "")}`.toLowerCase();
      return eventModule(item) === "whatsapp" && (bucket.includes("failed") || bucket.includes("erro"));
    }).length;
    const payments = filteredEvents.filter(item => eventAction(item).includes("PAYMENT_RECEIVED")).length;
    const opStateChanges = filteredEvents.filter(item => eventAction(item).includes("OPERATIONAL_STATE_CHANGED")).length;
    const governanceRuns = filteredEvents.filter(item => {
      const action = eventAction(item);
      return action.includes("GOVERNANCE_RUN_STARTED") || action.includes("GOVERNANCE_RUN_COMPLETED");
    }).length;

    return { critical, failedMessaging, payments, opStateChanges, governanceRuns };
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
    setModeFilter("global");
  }

  return (
    <PageWrapper
      title="Timeline"
      subtitle="Memória oficial para diagnóstico, risco e governança."
    >
      <OperationalTopCard
        contextLabel="Rastreabilidade oficial"
        title="Se não está na timeline, não aconteceu"
        description="A timeline V2 concentra histórico rastreável por cliente, entidade e módulo para decisão operacional."
        primaryAction={
          <Button type="button" variant="outline" onClick={() => void timelineQuery.refetch()}>
            Atualizar timeline
          </Button>
        }
      />
      <AppPageShell>
      <AppPageHeader
        title="Timeline"
        description="Memória oficial da operação para diagnóstico rápido, risco e governança."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AppStatusBadge label={`Período: ${periodFilter === "all" ? "Total" : periodFilter}`} />
            <AppStatusBadge
              label={summary.critical > 0 ? `${summary.critical} críticos` : `${filteredEvents.length} eventos no recorte`}
            />
            <Button type="button" variant="outline" onClick={() => void timelineQuery.refetch()}>
              Atualizar timeline
            </Button>
          </div>
        }
      />

      <AppSectionCard className="space-y-3">
        <AppToolbar className="flex-col items-stretch gap-3 p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { value: "global", label: "Leitura global" },
              { value: "customer", label: "Por cliente" },
              { value: "entity", label: "Por entidade" },
              { value: "module", label: "Por módulo" },
            ] as Array<{ value: ModeFilter; label: string }>).map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setModeFilter(option.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  modeFilter === option.value
                    ? "border-[color-mix(in_srgb,var(--accent-primary)_72%,black)] bg-[var(--accent-primary)] text-white"
                    : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-secondary)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <input
              value={searchValue}
              onChange={event => setSearchValue(event.target.value)}
              placeholder="Buscar por evento, entidade, responsável ou contexto"
              className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)]"
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
            <AppSelect value={moduleFilter} onValueChange={value => setModuleFilter(value as ModuleFilter)} options={MODULE_OPTIONS} />
            <AppSelect
              value={severityFilter}
              onValueChange={value => setSeverityFilter(value as SeverityFilter)}
              options={[
                { value: "all", label: "Criticidade" },
                { value: "critical", label: "Crítico" },
                { value: "high", label: "Alta" },
                { value: "medium", label: "Média" },
                { value: "low", label: "Baixa" },
              ]}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <AppSelect
              value={eventTypeFilter}
              onValueChange={setEventTypeFilter}
              options={[{ value: "all", label: "Tipo de evento" }, ...eventTypeOptions]}
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
              options={[{ value: "all", label: "Responsável" }, ...responsibleOptions]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={clearFilters}>
              Limpar filtros
            </Button>
            <span className="text-xs text-[var(--text-muted)]">
              Leitura oficial: {filteredEvents.length} evento(s) relevantes no recorte atual.
            </span>
          </div>
        </AppToolbar>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <AppStatusBadge label={`Críticos recentes: ${summary.critical}`} />
          <AppStatusBadge label={`Falhas de envio: ${summary.failedMessaging}`} />
          <AppStatusBadge label={`Pagamentos recebidos: ${summary.payments}`} />
          <AppStatusBadge label={`Mudanças operacionais: ${summary.opStateChanges}`} />
          <AppStatusBadge label={`Execuções de governança: ${summary.governanceRuns}`} />
        </div>
      </AppSectionCard>

      <div className="grid gap-3 xl:grid-cols-12">
        <AppSectionBlock
          title="Linha do tempo oficial"
          subtitle="Leitura auditável por lotes com contexto operacional."
          className="xl:col-span-8"
        >
          {isInitialLoading ? (
            <div className="space-y-2">
              <AppPageLoadingState
                title="Carregando memória oficial"
                description="Montando timeline com filtros, prioridade e vínculos operacionais."
              />
              <AppSkeleton className="h-20" />
              <AppSkeleton className="h-20" />
            </div>
          ) : hasInitialError ? (
            <AppPageErrorState
              description={timelineQuery.error?.message ?? "Falha ao carregar timeline."}
              actionLabel="Tentar novamente"
              onAction={() => void timelineQuery.refetch()}
            />
          ) : filteredEvents.length === 0 ? (
            <AppPageEmptyState
              title="Sem eventos para este recorte"
              description="Ajuste os filtros ou gere operação real para manter a memória oficial auditável." 
            />
          ) : (
            <div className="space-y-4">
              {groupedEvents.map(([dateLabel, dayEvents]) => (
                <section key={dateLabel} className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{dateLabel}</p>
                  <AppTimeline>
                    {dayEvents.map(event => {
                      const module = eventModule(event);
                      const severity = eventSeverity(event);
                      const isSelected = String(event?.id) === String(selectedEvent?.id ?? "");

                      return (
                        <AppTimelineItem
                          key={String(event?.id ?? `${eventEntityId(event)}-${event?.createdAt}`)}
                          className={`cursor-pointer border ${
                            isSelected
                              ? "border-[var(--accent-primary)]/40 bg-[var(--accent-soft)]/25"
                              : "border-[var(--border-subtle)] bg-[var(--surface-base)]/70"
                          }`}
                          onClick={() => setSelectedEventId(String(event?.id))}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <EventIcon module={module} severity={severity} />
                                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                  {eventAction(event).replace(/_/g, " ")}
                                </p>
                              </div>
                              <p className="mt-1 text-sm text-[var(--text-secondary)]">{eventReason(event)}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <AppPriorityBadge label={severity} />
                              <AppStatusBadge label={MODULE_OPTIONS.find(option => option.value === module)?.label ?? "Operação"} />
                            </div>
                          </div>

                          <div className="mt-2 grid gap-1 text-xs text-[var(--text-muted)] md:grid-cols-2">
                            <p>Entidade: {eventEntityLabel(event)} #{eventEntityId(event)}</p>
                            <p>Responsável: {text(event?.personName ?? event?.actorName, "Sistema")}</p>
                            <p>Quando: {formatDateTime(event?.createdAt)}</p>
                            <p>Cliente: {eventCustomerId(event) ? `#${eventCustomerId(event)}` : "Não vinculado"}</p>
                          </div>
                        </AppTimelineItem>
                      );
                    })}
                  </AppTimeline>
                </section>
              ))}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">
                  Exibindo {filteredEvents.length} evento(s) · lote de {PAGE_SIZE}.
                </span>
                <Button type="button" variant="outline" onClick={loadMore} disabled={!hasMore || timelineQuery.isFetching}>
                  {timelineQuery.isFetching ? "Carregando..." : hasMore ? `Carregar mais ${PAGE_SIZE}` : "Sem mais eventos"}
                </Button>
              </div>
            </div>
          )}
        </AppSectionBlock>

        <div className="space-y-3 xl:col-span-4">
          <AppSectionBlock
            title="Detalhe e contexto do evento"
            subtitle="Investigação rápida com vínculo cruzado para cliente, agenda, O.S., financeiro, WhatsApp e governança."
          >
            {!selectedEvent ? (
              <AppPageEmptyState
                title="Selecione um evento"
                description="Clique em um item da timeline para abrir contexto, motivo e encaminhamento." 
              />
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Resumo</p>
                  <p className="mt-1 font-semibold text-[var(--text-primary)]">{eventAction(selectedEvent).replace(/_/g, " ")}</p>
                  <p className="mt-1 text-[var(--text-secondary)]">{eventReason(selectedEvent)}</p>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Rastro oficial</p>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <li>Entidade: {eventEntityLabel(selectedEvent)} #{eventEntityId(selectedEvent)}</li>
                    <li>Responsável: {text(selectedEvent?.personName ?? selectedEvent?.actorName, "Sistema")}</li>
                    <li>Data/hora: {formatDateTime(selectedEvent?.createdAt)}</li>
                    <li>Módulo: {MODULE_OPTIONS.find(option => option.value === eventModule(selectedEvent))?.label ?? "Operação"}</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Diagnóstico e risco</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AppStatusBadge label={eventSeverity(selectedEvent) === "critical" ? "Em risco" : "Monitorado"} />
                    {eventModule(selectedEvent) === "governance" ? <ShieldAlert className="h-4 w-4 text-violet-400" /> : null}
                    {eventModule(selectedEvent) === "finance" ? <BadgeDollarSign className="h-4 w-4 text-emerald-400" /> : null}
                    {eventSeverity(selectedEvent) === "critical" ? <AlertTriangle className="h-4 w-4 text-rose-400" /> : null}
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    {eventSeverity(selectedEvent) === "critical"
                      ? "Evento com potencial de escalada operacional. Priorize resposta e fechamento rastreável."
                      : "Evento com rastro íntegro para continuidade operacional e auditoria."}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Button type="button" variant="outline" onClick={() => navigate("/customers")}>
                    Abrir cliente relacionado
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/appointments")}>
                    Abrir agendamento
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/service-orders")}>
                    Abrir O.S.
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/finances")}>
                    Abrir financeiro
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/whatsapp")}>
                    Abrir WhatsApp
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/governance")}>
                    Abrir governança
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate(eventRoute(selectedEvent))}>
                    Abrir contexto principal <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Prioridades operacionais"
            subtitle="Blocos curtos acionáveis para leitura de risco e governança."
            compact
          >
            <div className="space-y-2 text-xs">
              <p className="rounded-lg border border-[var(--border-subtle)] p-2 text-[var(--text-secondary)]">
                Críticos recentes: <strong className="text-[var(--text-primary)]">{summary.critical}</strong>
              </p>
              <p className="rounded-lg border border-[var(--border-subtle)] p-2 text-[var(--text-secondary)]">
                Falhas de envio: <strong className="text-[var(--text-primary)]">{summary.failedMessaging}</strong>
              </p>
              <p className="rounded-lg border border-[var(--border-subtle)] p-2 text-[var(--text-secondary)]">
                Mudanças de estado operacional: <strong className="text-[var(--text-primary)]">{summary.opStateChanges}</strong>
              </p>
              <p className="rounded-lg border border-[var(--border-subtle)] p-2 text-[var(--text-secondary)]">
                Governança executada: <strong className="text-[var(--text-primary)]">{summary.governanceRuns}</strong>
              </p>
              <p className="rounded-lg border border-[var(--border-subtle)] p-2 text-[var(--text-secondary)]">
                Preparado para painel lateral futuro com evento selecionado e filtros persistidos.
                <Link2 className="ml-1 inline h-3.5 w-3.5" />
              </p>
            </div>
          </AppSectionBlock>
        </div>
      </div>
      </AppPageShell>
    </PageWrapper>
  );
}
