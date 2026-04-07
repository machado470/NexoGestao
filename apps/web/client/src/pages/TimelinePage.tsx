import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { Button } from "@/components/ui/button";
import {
  History,
  RefreshCcw,
  CalendarDays,
  Filter,
  Search,
  FileJson,
  Receipt,
  Wrench,
  CircleCheck,
  AlertTriangle,
  Clock3,
  ArrowRight,
  Link2,
  Wallet,
  ShieldAlert,
  Users,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";
import {
  formatDateTime,
  getTimelineEventDescription,
  getTimelineEventKey,
  getTimelineEventLabel,
  getTimelineEventNextAction,
  getTimelineEventPrimaryLink,
  getTimelineEventSecondaryLinks,
  getTimelineEventSummary,
} from "@/lib/operations/operations.utils";

type CustomerOption = {
  id: string;
  name: string;
};

type TimelineEvent = {
  id: string;
  action?: string | null;
  type?: string | null;
  eventType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  customerId?: string | null;
  description?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

type EventScope =
  | "ALL"
  | "CUSTOMERS"
  | "APPOINTMENTS"
  | "SERVICE_ORDERS"
  | "FINANCIAL"
  | "RISK"
  | "GOVERNANCE";

function getEventTone(event: TimelineEvent) {
  const key = getTimelineEventKey(event);

  if (
    key.includes("PAID") ||
    key.includes("DONE") ||
    key.includes("COMPLETED") ||
    key.includes("CONFIRMED") ||
    key.includes("CREATED") ||
    key.includes("RECEIVED")
  ) {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  }

  if (
    key.includes("OVERDUE") ||
    key.includes("CANCELED") ||
    key.includes("CANCELLED") ||
    key.includes("NO_SHOW") ||
    key.includes("CONFLICT") ||
    key.includes("SUSPENDED") ||
    key.includes("RESTRICTED")
  ) {
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  }

  if (
    key.includes("UPDATED") ||
    key.includes("ASSIGNED") ||
    key.includes("STARTED") ||
    key.includes("WARNING") ||
    key.includes("RISK")
  ) {
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
  }

  return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
}

function getEventIcon(event: TimelineEvent) {
  const key = getTimelineEventKey(event);

  if (key.includes("GOVERNANCE") || key.includes("STATE_CHANGED")) {
    return ShieldAlert;
  }

  if (key.includes("RISK")) {
    return AlertTriangle;
  }

  if (key.includes("CHARGE") || key.includes("PAYMENT")) {
    return Receipt;
  }

  if (key.includes("DONE") || key.includes("PAID") || key.includes("CONFIRMED")) {
    return CircleCheck;
  }

  if (key.includes("OVERDUE") || key.includes("CANCELED")) {
    return AlertTriangle;
  }

  if (key.includes("SERVICE_ORDER") || key.includes("EXECUTION")) {
    return Wrench;
  }

  return Clock3;
}

function getEventScope(event: TimelineEvent): EventScope {
  const key = getTimelineEventKey(event);

  if (key.includes("CUSTOMER")) return "CUSTOMERS";
  if (key.includes("APPOINTMENT")) return "APPOINTMENTS";
  if (key.includes("SERVICE_ORDER")) return "SERVICE_ORDERS";
  if (key.includes("CHARGE") || key.includes("PAYMENT")) return "FINANCIAL";
  if (key.includes("RISK")) return "RISK";
  if (key.includes("GOVERNANCE") || key.includes("STATE_CHANGED")) {
    return "GOVERNANCE";
  }

  return "ALL";
}

function mapCustomerOptions(payload: unknown): CustomerOption[] {
  return normalizeArrayPayload<any>(payload)
    .map((customer) => ({
      id: String(customer?.id ?? ""),
      name: String(customer?.name ?? ""),
    }))
    .filter((customer) => customer.id && customer.name);
}

function mapTimelineEvents(payload: unknown): TimelineEvent[] {
  return normalizeArrayPayload<TimelineEvent>(payload).filter(
    (event) => Boolean(event?.id)
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  valueClassName,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  valueClassName?: string;
}) {
  return (
    <div className="nexo-kpi-card">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p
        className={`mt-1 text-2xl font-bold text-gray-900 dark:text-white ${
          valueClassName ?? ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );
}

function getCustomerIdFromLocation(location: string) {
  const queryString = location.includes("?") ? location.split("?")[1] : "";
  const params = new URLSearchParams(queryString);
  return params.get("customerId")?.trim() || "";
}

export default function TimelinePage() {
  const [location, navigate] = useLocation();
  const customerIdFromUrl = useMemo(
    () => getCustomerIdFromLocation(location),
    [location]
  );

  const [customerId, setCustomerId] = useState<string>(customerIdFromUrl);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<EventScope>("ALL");
  const [showMetadata, setShowMetadata] = useState(false);

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const timelineQuery = trpc.nexo.timeline.listByCustomer.useQuery(
    { customerId },
    {
      enabled: Boolean(customerId),
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const customers = useMemo(() => {
    return mapCustomerOptions(customersQuery.data);
  }, [customersQuery.data]);

  const events = useMemo(() => {
    return mapTimelineEvents(timelineQuery.data);
  }, [timelineQuery.data]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return events.filter((event) => {
      const eventScope = getEventScope(event);
      const inScope = scopeFilter === "ALL" || eventScope === scopeFilter;

      if (!inScope) return false;

      if (!term) return true;

      const label = getTimelineEventLabel(event).toLowerCase();
      const description = getTimelineEventDescription(event).toLowerCase();
      const summary = getTimelineEventSummary(event).toLowerCase();
      const metadata = JSON.stringify(event.metadata ?? {}).toLowerCase();

      return (
        label.includes(term) ||
        description.includes(term) ||
        summary.includes(term) ||
        metadata.includes(term)
      );
    });
  }, [events, search, scopeFilter]);

  const stats = useMemo(() => {
    return {
      total: filteredEvents.length,
      appointments: filteredEvents.filter(
        (event) => getEventScope(event) === "APPOINTMENTS"
      ).length,
      serviceOrders: filteredEvents.filter(
        (event) => getEventScope(event) === "SERVICE_ORDERS"
      ).length,
      financial: filteredEvents.filter(
        (event) => getEventScope(event) === "FINANCIAL"
      ).length,
      governance: filteredEvents.filter((event) => {
        const scope = getEventScope(event);
        return scope === "RISK" || scope === "GOVERNANCE";
      }).length,
    };
  }, [filteredEvents]);

  useEffect(() => {
    if (customerIdFromUrl && customerIdFromUrl !== customerId) {
      setCustomerId(customerIdFromUrl);
    }
  }, [customerIdFromUrl, customerId]);

  useEffect(() => {
    if (customerIdFromUrl) return;
    if (!customerId && customers.length > 0) {
      setCustomerId(customers[0].id);
    }
  }, [customerId, customerIdFromUrl, customers]);

  useEffect(() => {
    if (!customerId) return;

    const current = getCustomerIdFromLocation(location);
    if (current === customerId) return;

    navigate(`/timeline?customerId=${customerId}`, { replace: true });
  }, [customerId, location, navigate]);

  useEffect(() => {
    if (customersQuery.error) {
      toast.error("Erro ao carregar clientes: " + customersQuery.error.message);
    }
  }, [customersQuery.error]);

  useEffect(() => {
    if (timelineQuery.error) {
      toast.error("Erro ao carregar timeline: " + timelineQuery.error.message);
    }
  }, [timelineQuery.error]);

  const selectedCustomer =
    customers.find((customer) => customer.id === customerId) ?? null;

  const filters: { value: EventScope; label: string }[] = [
    { value: "ALL", label: "Tudo" },
    { value: "CUSTOMERS", label: "Clientes" },
    { value: "APPOINTMENTS", label: "Agendamentos" },
    { value: "SERVICE_ORDERS", label: "Execução" },
    { value: "FINANCIAL", label: "Financeiro" },
    { value: "RISK", label: "Risco" },
    { value: "GOVERNANCE", label: "Governança" },
  ];

  const hasFatalError =
    customersQuery.isError || (Boolean(customerId) && timelineQuery.isError);

  const fatalErrorMessage =
    customersQuery.error?.message ||
    timelineQuery.error?.message ||
    "Não foi possível carregar a timeline agora.";

  const isInitialLoading =
    customersQuery.isLoading || (Boolean(customerId) && timelineQuery.isLoading);

  return (
    <PageShell>
      <PageHero
        eyebrow="Auditoria operacional com leitura humana"
        title="Timeline"
        description="Aqui o sistema mostra a história da operação: agenda, execução, financeiro, risco e governança em ordem cronológica."
        actions={<>
          <Button
            variant="outline"
            onClick={() => void timelineQuery.refetch()}
            disabled={!customerId || timelineQuery.isFetching}
            className="gap-2"
          >
            <RefreshCcw
              className={`h-4 w-4 ${
                timelineQuery.isFetching ? "animate-spin" : ""
              }`}
            />
            Atualizar
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setShowMetadata((prev) => !prev)}
            className="gap-2"
          >
            <FileJson className="h-4 w-4" />
            {showMetadata ? "Ocultar metadata" : "Mostrar metadata"}
          </Button>
        </>}
      />

      {hasFatalError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {fatalErrorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <SummaryCard title="Eventos" value={stats.total} subtitle="Histórico visível" />
        <SummaryCard
          title="Agendamentos"
          value={stats.appointments}
          subtitle="Entrada do fluxo"
          valueClassName="text-blue-600 dark:text-blue-400"
        />
        <SummaryCard
          title="Execução"
          value={stats.serviceOrders}
          subtitle="O.S. e operação"
          valueClassName="text-orange-600 dark:text-orange-400"
        />
        <SummaryCard
          title="Financeiro"
          value={stats.financial}
          subtitle="Cobrança e pagamento"
          valueClassName="text-green-600 dark:text-green-400"
        />
        <SummaryCard
          title="Risco e governança"
          value={stats.governance}
          subtitle="Leitura de controle"
          valueClassName="text-red-600 dark:text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <div className="nexo-kpi-card">
            <div className="mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Escopo e filtros
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Cliente
                </label>

                {customersQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando clientes...
                  </div>
                ) : customers.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Nenhum cliente encontrado.
                  </div>
                ) : (
                  <select
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Buscar nos eventos
                </label>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="O.S., cobrança, risco, governança..."
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipo de evento
                </p>

                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setScopeFilter(filter.value)}
                      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                        scopeFilter === filter.value
                          ? "bg-orange-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 dark:border-orange-900/40 dark:bg-orange-950/20">
                <p className="text-xs font-medium uppercase tracking-wide text-orange-700 dark:text-orange-300">
                  Escopo atual
                </p>
                <p className="mt-1 text-sm font-semibold text-orange-900 dark:text-orange-200">
                  {selectedCustomer?.name ?? "—"}
                </p>
                <p className="mt-2 text-xs text-orange-700 dark:text-orange-300">
                  {scopeFilter === "ALL"
                    ? "Leitura completa do histórico do cliente."
                    : `Filtro ativo: ${
                        filters.find((item) => item.value === scopeFilter)?.label ?? "Tudo"
                      }.`}
                </p>
              </div>
            </div>
          </div>

          <div className="nexo-kpi-card">
            <div className="mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Leitura rápida
              </h2>
            </div>

            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="nexo-subtle-surface p-3">
                <p className="font-medium text-gray-900 dark:text-white">
                  Agenda → execução
                </p>
                <p className="mt-1">
                  Veja se o histórico está parando em agendamento ou realmente
                  puxando O.S.
                </p>
              </div>

              <div className="nexo-subtle-surface p-3">
                <p className="font-medium text-gray-900 dark:text-white">
                  Execução → financeiro
                </p>
                <p className="mt-1">
                  O ponto crítico é serviço concluído sem cobrança ou com
                  cobrança vencida.
                </p>
              </div>

              <div className="nexo-subtle-surface p-3">
                <p className="font-medium text-gray-900 dark:text-white">
                  Risco → governança
                </p>
                <p className="mt-1">
                  Quando esses eventos aparecem, a operação já está pedindo
                  leitura de controle, não só execução.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="nexo-kpi-card">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Histórico cronológico
            </h2>
          </div>

          {!customerId ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Selecione um cliente para ver a timeline.
            </div>
          ) : isInitialLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando eventos...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum evento encontrado para este filtro.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map((event) => {
                const Icon = getEventIcon(event);
                const summary = getTimelineEventSummary(event);
                const description = getTimelineEventDescription(event);
                const nextAction = getTimelineEventNextAction(event);
                const primaryLink = getTimelineEventPrimaryLink(event);
                const secondaryLinks = getTimelineEventSecondaryLinks(event);

                return (
                  <div
                    key={event.id}
                    className="nexo-subtle-surface p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getEventTone(
                              event
                            )}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {getTimelineEventLabel(event)}
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {filters.find((item) => item.value === getEventScope(event))
                              ?.label ?? "Contexto"}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-gray-900 dark:text-white">
                          {description}
                        </p>

                        {summary ? (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {summary}
                          </p>
                        ) : null}
                      </div>

                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(event.createdAt)}
                      </div>
                    </div>

                    <div className={`mt-4 rounded-lg border p-3 ${nextAction.tone}`}>
                      <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                        Próxima leitura
                      </p>
                      <p className="mt-1 text-sm font-medium">{nextAction.label}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {primaryLink ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => navigate(primaryLink.href)}
                          className="gap-2"
                        >
                          {primaryLink.target === "serviceOrder" ? (
                            <Wrench className="h-4 w-4" />
                          ) : primaryLink.target === "charge" ||
                            primaryLink.target === "payment" ? (
                            <Wallet className="h-4 w-4" />
                          ) : primaryLink.target === "customer" ? (
                            <Users className="h-4 w-4" />
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                          {primaryLink.label}
                        </Button>
                      ) : null}

                      {secondaryLinks
                        .filter((link) => link.href !== primaryLink?.href)
                        .map((link) => (
                          <Button
                            key={`${event.id}-${link.target}-${link.href}`}
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(link.href)}
                            className="gap-2"
                          >
                            {link.target === "serviceOrder" ? (
                              <Wrench className="h-4 w-4" />
                            ) : link.target === "charge" ||
                              link.target === "payment" ? (
                              <Wallet className="h-4 w-4" />
                            ) : link.target === "customer" ? (
                              <Users className="h-4 w-4" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                            {link.label}
                          </Button>
                        ))}
                    </div>

                    {showMetadata && event.metadata ? (
                      <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
