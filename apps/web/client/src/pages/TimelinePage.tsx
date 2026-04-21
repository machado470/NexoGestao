import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  FileClock,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UserCircle2,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { Button } from "@/components/design-system";
import {
  AppKpiRow,
  AppNextActionCard,
  AppOperationalBar,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPriorityBadge,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import {
  formatDelta,
  getDayWindow,
  percentDelta,
  safeDate,
  trendFromDelta,
} from "@/lib/operational/kpi";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";
import { TrpcSectionErrorBoundary } from "@/components/TrpcSectionErrorBoundary";
import { setBootPhase } from "@/lib/bootPhase";
import { AppSelect } from "@/components/app-system";

type TimelineEvent = Record<string, any>;
type ModuleFilter = "all" | "finance" | "service_order" | "appointment" | "whatsapp" | "governance" | "customer";

const PAGE_SIZE = 30;

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

function eventModule(event: TimelineEvent): ModuleFilter {
  const bucket = [
    text(event?.action, "").toLowerCase(),
    text(event?.description, "").toLowerCase(),
    text(event?.serviceOrderId, "").toLowerCase(),
    text(event?.appointmentId, "").toLowerCase(),
    text(event?.chargeId, "").toLowerCase(),
    text((event?.metadata ?? {})?.module, "").toLowerCase(),
  ].join(" ");

  if (event?.chargeId || bucket.includes("payment") || bucket.includes("charge") || bucket.includes("finance")) return "finance";
  if (event?.serviceOrderId || bucket.includes("service_order") || bucket.includes("service order") || bucket.includes("o.s")) return "service_order";
  if (event?.appointmentId || bucket.includes("appointment") || bucket.includes("agenda")) return "appointment";
  if (bucket.includes("whatsapp") || bucket.includes("message") || bucket.includes("comunica")) return "whatsapp";
  if (bucket.includes("govern") || bucket.includes("operational_state")) return "governance";
  if (event?.customerId || bucket.includes("customer") || bucket.includes("cliente")) return "customer";
  return "all";
}

function eventSeverity(event: TimelineEvent): "critical" | "high" | "medium" | "low" {
  const bucket = [
    text(event?.action, "").toLowerCase(),
    text(event?.description, "").toLowerCase(),
    text(event?.status, "").toLowerCase(),
  ].join(" ");
  if (bucket.includes("failed") || bucket.includes("error") || bucket.includes("cancel") || bucket.includes("atras")) return "critical";
  if (bucket.includes("risk") || bucket.includes("overdue") || bucket.includes("warning") || bucket.includes("block")) return "high";
  if (bucket.includes("confirm") || bucket.includes("updated") || bucket.includes("state")) return "medium";
  return "low";
}

function eventReason(event: TimelineEvent) {
  const description = text(event?.description, "");
  if (description) return description;
  const action = eventAction(event);
  if (action.includes("CREATED")) return "Registro criado para iniciar fluxo operacional auditável.";
  if (action.includes("COMPLETED") || action.includes("DONE")) return "Execução concluída com rastreabilidade preservada.";
  if (action.includes("CANCELED") || action.includes("NO_SHOW")) return "Evento de ruptura operacional registrado para análise de risco.";
  if (action.includes("OPERATIONAL_STATE_CHANGED")) return "Mudança de estado operacional registrada pela governança.";
  return "Evento registrado para memória oficial da operação.";
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
  return "/dashboard";
}

function EventIcon({ module, severity }: { module: ModuleFilter; severity: "critical" | "high" | "medium" | "low" }) {
  if (severity === "critical") return <Siren className="h-4 w-4 text-rose-400" />;
  if (module === "finance") return <BadgeDollarSign className="h-4 w-4 text-emerald-400" />;
  if (module === "appointment") return <CalendarClock className="h-4 w-4 text-sky-400" />;
  if (module === "whatsapp") return <MessageSquare className="h-4 w-4 text-teal-400" />;
  if (module === "governance") return <ShieldCheck className="h-4 w-4 text-violet-400" />;
  if (module === "service_order") return <FileClock className="h-4 w-4 text-amber-400" />;
  return <CheckCircle2 className="h-4 w-4 text-[var(--text-muted)]" />;
}

export default function TimelinePage() {
  setBootPhase("PAGE:Timeline");
  useRenderWatchdog("TimelinePage");
  const [, navigate] = useLocation();

  const [searchValue, setSearchValue] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("7d");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [responsibleFilter, setResponsibleFilter] = useState("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
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

  const dynamicEventTypes = useMemo(() => {
    const values = Array.from(new Set(events.map(event => eventAction(event))));
    return values.slice(0, 20).map(value => ({ value, label: value.replace(/_/g, " ") }));
  }, [events]);

  const dynamicEntities = useMemo(() => {
    const values = Array.from(new Set(events.map(event => eventEntityLabel(event))));
    return values.slice(0, 20).map(value => ({ value: value.toLowerCase(), label: value }));
  }, [events]);

  const dynamicResponsibles = useMemo(() => {
    const values = Array.from(
      new Set(events.map(event => text(event?.personName ?? event?.actorName, "Sistema")))
    );
    return values.slice(0, 20).map(value => ({ value: value.toLowerCase(), label: value }));
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return events.filter(event => {
      const createdAt = safeDate(event?.createdAt);
      const action = eventAction(event);
      const entity = eventEntityLabel(event);
      const module = eventModule(event);
      const responsible = text(event?.personName ?? event?.actorName, "Sistema");

      if (eventTypeFilter !== "all" && action !== eventTypeFilter) return false;
      if (moduleFilter !== "all" && module !== moduleFilter) return false;
      if (entityFilter !== "all" && entity.toLowerCase() !== entityFilter) return false;
      if (responsibleFilter !== "all" && responsible.toLowerCase() !== responsibleFilter) return false;

      if (periodFilter === "24h" && (!createdAt || Date.now() - createdAt.getTime() > 24 * 60 * 60 * 1000)) return false;
      if (periodFilter === "7d" && (!createdAt || Date.now() - createdAt.getTime() > 7 * 24 * 60 * 60 * 1000)) return false;
      if (periodFilter === "30d" && (!createdAt || Date.now() - createdAt.getTime() > 30 * 24 * 60 * 60 * 1000)) return false;

      if (!q) return true;
      const haystack = [
        action,
        text(event?.description, ""),
        entity,
        eventEntityId(event),
        responsible,
        module,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [entityFilter, eventTypeFilter, events, moduleFilter, periodFilter, responsibleFilter, searchValue]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, TimelineEvent[]>();
    filteredEvents.forEach(event => {
      const key = event?.createdAt
        ? new Date(String(event.createdAt)).toLocaleDateString("pt-BR")
        : "Sem data";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(event);
    });
    return Array.from(groups.entries());
  }, [filteredEvents]);

  const selectedEvent = useMemo(
    () => filteredEvents.find(event => String(event?.id) === selectedEventId) ?? filteredEvents[0] ?? null,
    [filteredEvents, selectedEventId]
  );

  const currentDay = getDayWindow(0);
  const previousDay = getDayWindow(1);
  const eventsToday = events.filter(event => {
    const date = safeDate(event?.createdAt);
    return Boolean(date && date >= currentDay.start && date < currentDay.end);
  }).length;
  const eventsYesterday = events.filter(event => {
    const date = safeDate(event?.createdAt);
    return Boolean(date && date >= previousDay.start && date < previousDay.end);
  }).length;

  const criticalEvents = filteredEvents.filter(event => eventSeverity(event) === "critical").length;
  const governanceEvents = filteredEvents.filter(event => eventModule(event) === "governance").length;
  const financialEvents = filteredEvents.filter(event => eventModule(event) === "finance").length;
  const riskSensitiveEvents = filteredEvents.filter(event => {
    const bucket = `${eventAction(event)} ${text(event?.description, "")}`.toLowerCase();
    return bucket.includes("risk") || bucket.includes("no_show") || bucket.includes("cancel") || bucket.includes("overdue");
  }).length;

  const pressureModule = useMemo(() => {
    const modules = filteredEvents.reduce<Record<string, number>>((acc, event) => {
      const module = eventModule(event);
      acc[module] = (acc[module] ?? 0) + 1;
      return acc;
    }, {});
    const sorted = Object.entries(modules).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? "all";
  }, [filteredEvents]);

  const diagnostics: Array<{
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
  }> = [
    {
      title: "Pressão operacional",
      description:
        pressureModule !== "all"
          ? `Maior concentração recente em ${MODULE_OPTIONS.find(option => option.value === pressureModule)?.label ?? "operação"}.`
          : "Distribuição de eventos sem concentração crítica por módulo.",
      severity: criticalEvents > 0 ? "high" : "medium" as const,
    },
    {
      title: "Sinal de risco",
      description:
        riskSensitiveEvents > 0
          ? `${riskSensitiveEvents} eventos com impacto potencial em risco (cancelamentos, atrasos ou falhas).`
          : "Sem sinais fortes de escalada de risco na janela filtrada.",
      severity: riskSensitiveEvents > 0 ? "high" : "low" as const,
    },
    {
      title: "Governança ativa",
      description:
        governanceEvents > 0
          ? `${governanceEvents} eventos de governança e estado operacional registrados.`
          : "Sem novos eventos de governança na janela atual.",
      severity: governanceEvents > 0 ? "medium" : "low" as const,
    },
  ];

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] timeline");
  }, []);

  useEffect(() => {
    if (!timelineQuery.error) return;
    // eslint-disable-next-line no-console
    console.error("[TRPC ERROR] timeline_query_error", timelineQuery.error.message);
  }, [timelineQuery.error]);

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
    setResponsibleFilter("all");
    setPeriodFilter("7d");
  }

  return (
    <PageWrapper
      title="Timeline operacional"
      subtitle="Memória oficial para auditoria, diagnóstico e governança da operação."
    >
      <OperationalTopCard
        contextLabel="Memória oficial"
        title="Se não está na timeline, não aconteceu"
        description="Central de histórico para responder com rapidez: o que aconteceu, quando, quem executou e qual impacto operacional foi gerado."
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void timelineQuery.refetch()}>
              Atualizar histórico
            </Button>
            <Button type="button" onClick={loadMore} disabled={!hasMore || timelineQuery.isFetching}>
              {timelineQuery.isFetching ? "Carregando..." : "Carregar próximo lote"}
            </Button>
          </div>
        }
      />

      <KpiErrorBoundary context="timeline:kpi">
        <AppKpiRow
          items={[
            {
              title: "Eventos hoje",
              value: String(eventsToday),
              delta: formatDelta(percentDelta(eventsToday, eventsYesterday)),
              trend: trendFromDelta(percentDelta(eventsToday, eventsYesterday)),
              hint: "comparativo com ontem",
            },
            {
              title: "Eventos críticos",
              value: String(criticalEvents),
              hint: "impactam risco e continuidade",
              tone: criticalEvents > 0 ? "critical" : "default",
            },
            { title: "Governança", value: String(governanceEvents), hint: "execuções e mudanças de estado" },
            { title: "Financeiro", value: String(financialEvents), hint: "cobrança, pagamento e inadimplência" },
          ]}
        />
      </KpiErrorBoundary>

      <AppOperationalBar
        tabs={MODULE_OPTIONS}
        activeTab={moduleFilter}
        onTabChange={setModuleFilter}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Buscar por evento, entidade, responsável ou motivo"
        quickFilters={
          <>
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
            <AppSelect
              value={eventTypeFilter}
              onValueChange={setEventTypeFilter}
              options={[{ value: "all", label: "Tipo de evento" }, ...dynamicEventTypes]}
            />
          </>
        }
        advancedFiltersContent={
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Entidade</p>
              <AppSelect
                value={entityFilter}
                onValueChange={setEntityFilter}
                options={[{ value: "all", label: "Todas" }, ...dynamicEntities]}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Responsável</p>
              <AppSelect
                value={responsibleFilter}
                onValueChange={setResponsibleFilter}
                options={[{ value: "all", label: "Todos" }, ...dynamicResponsibles]}
              />
            </div>
          </div>
        }
        activeFilterChips={[
          periodFilter !== "7d"
            ? { key: "period", label: `Período: ${periodFilter}`, onRemove: () => setPeriodFilter("7d") }
            : null,
          eventTypeFilter !== "all"
            ? { key: "type", label: `Tipo: ${eventTypeFilter}`, onRemove: () => setEventTypeFilter("all") }
            : null,
          entityFilter !== "all"
            ? { key: "entity", label: `Entidade: ${entityFilter}`, onRemove: () => setEntityFilter("all") }
            : null,
          responsibleFilter !== "all"
            ? { key: "responsible", label: `Responsável: ${responsibleFilter}`, onRemove: () => setResponsibleFilter("all") }
            : null,
        ].filter(Boolean) as Array<{ key: string; label: string; onRemove?: () => void }>}
        onClearAllFilters={clearFilters}
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <TrpcSectionErrorBoundary context="timeline:feed">
          <AppSectionBlock
            title="Feed auditável"
            subtitle="Leitura vertical para diagnóstico rápido com rastreabilidade por evento e encaminhamento operacional."
            className="xl:col-span-8"
          >
            {isInitialLoading ? (
              <AppPageLoadingState description="Carregando histórico oficial da operação..." />
            ) : hasInitialError ? (
              <AppPageErrorState
                description={timelineQuery.error?.message ?? "Falha ao carregar timeline."}
                actionLabel="Tentar novamente"
                onAction={() => void timelineQuery.refetch()}
              />
            ) : filteredEvents.length === 0 ? (
              <AppPageEmptyState
                title="Sem eventos no filtro atual"
                description="Inicie a operação criando cliente, agendamento ou ação financeira para alimentar a memória oficial."
              />
            ) : (
              <div className="space-y-4">
                {groupedEvents.map(([dateLabel, dayEvents]) => (
                  <div key={dateLabel} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{dateLabel}</p>
                    <ul className="space-y-2">
                      {dayEvents.map(event => {
                        const module = eventModule(event);
                        const severity = eventSeverity(event);
                        const isSelected = String(event?.id) === String(selectedEvent?.id ?? "");
                        return (
                          <li
                            key={String(event?.id ?? `${eventEntityId(event)}-${event?.createdAt}`)}
                            className={`rounded-xl border p-3 ${
                              isSelected
                                ? "border-[var(--accent-primary)]/45 bg-[var(--accent-soft)]/30"
                                : "border-[var(--border-subtle)] bg-[var(--surface-base)]/70"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedEventId(String(event?.id))}>
                                <div className="flex items-center gap-2">
                                  <EventIcon module={module} severity={severity} />
                                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                                    {eventAction(event).replace(/_/g, " ")}
                                  </p>
                                </div>
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">{eventReason(event)}</p>
                              </button>
                              <div className="flex flex-wrap items-center gap-2">
                                <AppPriorityBadge
                                  label={severity === "critical" ? "Urgente" : severity === "high" ? "Alta" : severity === "medium" ? "Médio" : "Baixa"}
                                />
                                <AppStatusBadge
                                  label={
                                    severity === "critical"
                                      ? "Em risco"
                                      : module === "governance"
                                        ? "Governança"
                                        : module === "finance"
                                          ? "Financeiro"
                                          : "Operação"
                                  }
                                />
                              </div>
                            </div>
                            <div className="mt-2 grid gap-1 text-xs text-[var(--text-muted)] md:grid-cols-2">
                              <p>Entidade: {eventEntityLabel(event)} #{eventEntityId(event)}</p>
                              <p>Responsável: {text(event?.personName ?? event?.actorName, "Sistema")}</p>
                              <p>Quando: {event?.createdAt ? new Date(String(event.createdAt)).toLocaleString("pt-BR") : "Sem data"}</p>
                              <p>Módulo: {MODULE_OPTIONS.find(option => option.value === module)?.label ?? "Operação"}</p>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <p className="text-xs text-[var(--text-muted)]">Impacto operacional rastreado para auditoria e risco.</p>
                              <Button type="button" variant="outline" onClick={() => navigate(eventRoute(event))}>
                                Abrir contexto <ArrowRight className="ml-1 h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}

                <div className="pt-1">
                  <Button type="button" variant="outline" onClick={loadMore} disabled={!hasMore || timelineQuery.isFetching}>
                    {timelineQuery.isFetching ? "Carregando..." : hasMore ? "Carregar mais eventos" : "Sem mais eventos"}
                  </Button>
                </div>
              </div>
            )}
          </AppSectionBlock>
        </TrpcSectionErrorBoundary>

        <div className="space-y-3 xl:col-span-4">
          <AppSectionBlock
            title="Diagnóstico operacional"
            subtitle="Interpretação humana do feed recente para priorizar resposta rápida."
          >
            <div className="space-y-2.5">
              {diagnostics.map(item => (
                <AppNextActionCard
                  key={item.title}
                  title={item.title}
                  description={item.description}
                  severity={item.severity}
                  metadata="timeline"
                  action={{
                    label: "Ir para módulo",
                    onClick: () => navigate(item.title === "Governança ativa" ? "/governance" : item.title === "Sinal de risco" ? "/customers" : "/dashboard"),
                  }}
                />
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Painel do evento"
            subtitle="Contexto detalhado para auditoria, diagnóstico e navegação imediata."
          >
            {!selectedEvent ? (
              <AppPageEmptyState
                title="Selecione um evento"
                description="Escolha um item no feed para abrir entidade, motivo e impacto operacional." 
              />
            ) : (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Evento</p>
                  <p className="mt-1 font-semibold text-[var(--text-primary)]">{eventAction(selectedEvent).replace(/_/g, " ")}</p>
                  <p className="mt-1 text-[var(--text-secondary)]">{eventReason(selectedEvent)}</p>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Rastreabilidade</p>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <li>Entidade: {eventEntityLabel(selectedEvent)} #{eventEntityId(selectedEvent)}</li>
                    <li>Responsável: {text(selectedEvent?.personName ?? selectedEvent?.actorName, "Sistema")}</li>
                    <li>Data/hora: {selectedEvent?.createdAt ? new Date(String(selectedEvent.createdAt)).toLocaleString("pt-BR") : "Sem data"}</li>
                    <li>Módulo: {MODULE_OPTIONS.find(option => option.value === eventModule(selectedEvent))?.label ?? "Operação"}</li>
                  </ul>
                </div>

                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Impacto</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AppStatusBadge
                      label={eventSeverity(selectedEvent) === "critical" ? "Crítico" : eventSeverity(selectedEvent) === "high" ? "Atenção" : "Saudável"}
                    />
                    {eventModule(selectedEvent) === "governance" ? <ShieldAlert className="h-4 w-4 text-violet-400" /> : null}
                    {eventModule(selectedEvent) === "finance" ? <BadgeDollarSign className="h-4 w-4 text-emerald-400" /> : null}
                    {eventSeverity(selectedEvent) === "critical" ? <AlertTriangle className="h-4 w-4 text-rose-400" /> : null}
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    {eventSeverity(selectedEvent) === "critical"
                      ? "Evento com potencial de escalada de risco. Priorize reação e registre desfecho na timeline."
                      : "Evento dentro de fluxo normal, mantendo memória operacional íntegra."}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Button type="button" variant="outline" onClick={() => navigate(eventRoute(selectedEvent))}>
                    Abrir entidade relacionada
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/governance")}>
                    Abrir governança e risco
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate("/whatsapp")}>
                    Abrir comunicação WhatsApp
                  </Button>
                </div>
              </div>
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Estado da página"
            subtitle="Saúde atual da timeline para operação diária."
            compact
          >
            <div className="flex flex-wrap items-center gap-2">
              <AppStatusBadge label={hasInitialError ? "Crítico" : criticalEvents > 0 ? "Atenção" : filteredEvents.length === 0 ? "Vazio" : "Saudável"} />
              <UserCircle2 className="h-4 w-4 text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text-secondary)]">
                {hasInitialError
                  ? "Erro de carregamento impede leitura confiável da memória operacional."
                  : filteredEvents.length === 0
                    ? "Sem eventos para o filtro atual; gere operação para iniciar rastreabilidade."
                    : "Timeline carregada com contexto operacional e navegação entre módulos."}
              </span>
            </div>
          </AppSectionBlock>
        </div>
      </div>
    </PageWrapper>
  );
}
