import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  History,
  RefreshCcw,
  User,
  CalendarDays,
  Filter,
  Search,
  FileJson,
} from "lucide-react";
import { toast } from "sonner";

type CustomerOption = {
  id: string;
  name: string;
};

type TimelineEvent = {
  id: string;
  action?: string | null;
  type?: string | null;
  description?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventLabel(event: TimelineEvent) {
  return event.action ?? event.type ?? "EVENT";
}

function getEventTone(action?: string | null) {
  const key = String(action ?? "").toUpperCase();

  if (
    key.includes("PAID") ||
    key.includes("DONE") ||
    key.includes("CONFIRMED") ||
    key.includes("CREATED")
  ) {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  }

  if (
    key.includes("OVERDUE") ||
    key.includes("CANCELED") ||
    key.includes("CANCELLED") ||
    key.includes("NO_SHOW") ||
    key.includes("CONFLICT")
  ) {
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  }

  if (
    key.includes("UPDATED") ||
    key.includes("ASSIGNED") ||
    key.includes("STARTED")
  ) {
    return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
  }

  return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
}

export default function TimelinePage() {
  const [customerId, setCustomerId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showMetadata, setShowMetadata] = useState(false);

  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const timelineQuery = trpc.nexo.timeline.listByCustomer.useQuery(
    { customerId, limit: 100 },
    {
      enabled: Boolean(customerId),
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const customers = useMemo(() => {
    const payload = customersQuery.data;
    const rows = Array.isArray((payload as any)?.data)
      ? (payload as any).data
      : Array.isArray(payload)
        ? payload
        : [];

    return rows.map((customer: any) => ({
      id: String(customer.id),
      name: String(customer.name),
    })) as CustomerOption[];
  }, [customersQuery.data]);

  const events = useMemo(() => {
    const payload = timelineQuery.data;
    const rows = Array.isArray((payload as any)?.data)
      ? (payload as any).data
      : Array.isArray(payload)
        ? payload
        : [];

    return rows as TimelineEvent[];
  }, [timelineQuery.data]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return events;

    return events.filter((event) => {
      const action = getEventLabel(event).toLowerCase();
      const description = String(event.description ?? "").toLowerCase();
      const metadata = JSON.stringify(event.metadata ?? {}).toLowerCase();

      return (
        action.includes(term) ||
        description.includes(term) ||
        metadata.includes(term)
      );
    });
  }, [events, search]);

  useEffect(() => {
    if (!customerId && customers.length > 0) {
      setCustomerId(customers[0].id);
    }
  }, [customerId, customers]);

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

  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <History className="h-6 w-6 text-orange-500" />
            Timeline do Cliente
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Histórico operacional consolidado por cliente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void timelineQuery.refetch()}
            disabled={!customerId || timelineQuery.isFetching}
            className="gap-2"
          >
            <RefreshCcw
              className={`h-4 w-4 ${timelineQuery.isFetching ? "animate-spin" : ""}`}
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Filtros
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Cliente
              </label>

              {customersQuery.isLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
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
                  placeholder="Ação, descrição, metadata..."
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Cliente selecionado
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">
                {selectedCustomer?.name ?? "—"}
              </p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Eventos encontrados: {filteredEvents.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Eventos
            </h2>
          </div>

          {!customerId ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Selecione um cliente para ver a timeline.
            </div>
          ) : timelineQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Carregando eventos...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Nenhum evento encontrado para este filtro.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getEventTone(
                            event.action ?? event.type
                          )}`}
                        >
                          {getEventLabel(event)}
                        </span>

                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <User className="h-3 w-3" />
                          Evento #{event.id.slice(0, 8)}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-gray-900 dark:text-white">
                        {event.description?.trim() || "Sem descrição."}
                      </p>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateTime(event.createdAt)}
                    </div>
                  </div>

                  {showMetadata && event.metadata ? (
                    <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
