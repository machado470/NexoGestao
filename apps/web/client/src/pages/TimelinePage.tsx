import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
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
import {
  buildFinanceChargeUrl,
  buildServiceOrdersDeepLink,
} from "@/lib/operations/operations.utils";

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

type EventScope =
  | "ALL"
  | "APPOINTMENTS"
  | "SERVICE_ORDERS"
  | "FINANCIAL"
  | "RISK"
  | "GOVERNANCE";

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

function getEventKey(event: TimelineEvent) {
  return String(event.action ?? event.type ?? "EVENT").toUpperCase();
}

function getEventLabel(event: TimelineEvent) {
  const key = getEventKey(event);

  const labels: Record<string, string> = {
    CUSTOMER_CREATED: "Cliente criado",
    CUSTOMER_UPDATED: "Cliente atualizado",
    APPOINTMENT_CREATED: "Agendamento criado",
    APPOINTMENT_UPDATED: "Agendamento atualizado",
    APPOINTMENT_CONFIRMED: "Agendamento confirmado",
    APPOINTMENT_CANCELED: "Agendamento cancelado",
    APPOINTMENT_CANCELLED: "Agendamento cancelado",
    SERVICE_ORDER_CREATED: "O.S. criada",
    SERVICE_ORDER_UPDATED: "O.S. atualizada",
    SERVICE_ORDER_ASSIGNED: "O.S. atribuída",
    SERVICE_ORDER_STARTED: "Execução iniciada",
    SERVICE_ORDER_DONE: "Execução concluída",
    SERVICE_ORDER_COMPLETED: "Execução concluída",
    SERVICE_ORDER_CANCELED: "O.S. cancelada",
    CHARGE_CREATED: "Cobrança criada",
    CHARGE_UPDATED: "Cobrança atualizada",
    CHARGE_CANCELED: "Cobrança cancelada",
    CHARGE_CANCELLED: "Cobrança cancelada",
    CHARGE_DELETED: "Cobrança excluída",
    CHARGE_PAID: "Cobrança paga",
    CHARGE_OVERDUE: "Cobrança vencida",
    PAYMENT_RECEIVED: "Pagamento recebido",
    PAYMENT_CONFIRMED: "Pagamento confirmado",
    RISK_UPDATED: "Risco atualizado",
    GOVERNANCE_RUN_STARTED: "Governança iniciada",
    GOVERNANCE_RUN_COMPLETED: "Governança concluída",
    OPERATIONAL_STATE_CHANGED: "Estado operacional alterado",
    MESSAGE_SENT: "Mensagem enviada",
    PAYMENT_LINK_SENT: "Link de pagamento enviado",
  };

  return labels[key] ?? key.split("_").join(" ");
}

function getEventTone(action?: string | null) {
  const key = String(action ?? "").toUpperCase();

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
  const key = getEventKey(event);

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
  const key = getEventKey(event);

  if (key.includes("APPOINTMENT")) return "APPOINTMENTS";
  if (key.includes("SERVICE_ORDER")) return "SERVICE_ORDERS";
  if (key.includes("CHARGE") || key.includes("PAYMENT")) return "FINANCIAL";
  if (key.includes("RISK")) return "RISK";
  if (key.includes("GOVERNANCE") || key.includes("STATE_CHANGED")) {
    return "GOVERNANCE";
  }

  return "ALL";
}

function getEventSummary(event: TimelineEvent) {
  const metadata = (event.metadata ?? {}) as Record<string, any>;
  const appointmentId = metadata?.appointmentId;
  const serviceOrderId = metadata?.serviceOrderId;
  const chargeId = metadata?.chargeId;
  const paymentId = metadata?.paymentId;
  const amountCents = metadata?.amountCents;
  const status = metadata?.status;
  const dueDate = metadata?.dueDate;
  const method = metadata?.method;
  const previousState = metadata?.previousState;
  const nextState = metadata?.nextState;

  const pieces: string[] = [];

  if (appointmentId) {
    pieces.push(`Agendamento #${String(appointmentId).slice(0, 8)}`);
  }

  if (serviceOrderId) {
    pieces.push(`O.S. #${String(serviceOrderId).slice(0, 8)}`);
  }

  if (chargeId) {
    pieces.push(`Cobrança #${String(chargeId).slice(0, 8)}`);
  }

  if (paymentId) {
    pieces.push(`Pagamento #${String(paymentId).slice(0, 8)}`);
  }

  if (typeof amountCents === "number" && Number.isFinite(amountCents)) {
    pieces.push(
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(amountCents / 100)
    );
  }

  if (typeof method === "string" && method.trim()) {
    const methodLabels: Record<string, string> = {
      PIX: "PIX",
      CASH: "Dinheiro",
      CARD: "Cartão",
      TRANSFER: "Transferência",
      BANK_TRANSFER: "Transferência",
      OTHER: "Outro",
    };

    pieces.push(`Via ${methodLabels[method] ?? method}`);
  }

  if (typeof status === "string" && status.trim()) {
    const statusLabels: Record<string, string> = {
      PENDING: "Pendente",
      PAID: "Pago",
      OVERDUE: "Vencida",
      CANCELED: "Cancelada",
      OPEN: "Aberta",
      ASSIGNED: "Atribuída",
      IN_PROGRESS: "Em andamento",
      DONE: "Concluída",
      WARNING: "Atenção",
      RESTRICTED: "Restrito",
      SUSPENDED: "Suspenso",
      NORMAL: "Normal",
    };

    pieces.push(`Status ${statusLabels[status] ?? status}`);
  }

  if (typeof previousState === "string" && typeof nextState === "string") {
    pieces.push(`Estado ${previousState} → ${nextState}`);
  }

  if (typeof dueDate === "string" && dueDate.trim()) {
    const date = new Date(dueDate);
    if (!Number.isNaN(date.getTime())) {
      pieces.push(
        `Venc. ${date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })}`
      );
    }
  }

  return pieces.join(" • ");
}

function getNextAction(event: TimelineEvent) {
  const key = getEventKey(event);

  if (key.includes("CHARGE_OVERDUE")) {
    return {
      label: "Cobrar cliente",
      tone:
        "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
    };
  }

  if (key.includes("SERVICE_ORDER_DONE")) {
    return {
      label: "Verificar cobrança",
      tone:
        "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
    };
  }

  if (key.includes("APPOINTMENT_CREATED")) {
    return {
      label: "Confirmar agendamento",
      tone:
        "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300",
    };
  }

  if (key.includes("APPOINTMENT_CONFIRMED")) {
    return {
      label: "Abrir execução",
      tone:
        "border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
    };
  }

  if (key.includes("RISK") || key.includes("GOVERNANCE")) {
    return {
      label: "Revisar impacto operacional",
      tone:
        "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-300",
    };
  }

  return {
    label: "Sem ação crítica imediata",
    tone:
      "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
  };
}

function getMetadataId(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];

  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function normalizeCustomersPayload(payload: unknown): CustomerOption[] {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

  if (Array.isArray(raw)) {
    return raw
      .map((customer: any) => ({
        id: String(customer?.id ?? ""),
        name: String(customer?.name ?? ""),
      }))
      .filter((customer) => customer.id && customer.name);
  }

  if (Array.isArray(raw?.items)) {
    return raw.items
      .map((customer: any) => ({
        id: String(customer?.id ?? ""),
        name: String(customer?.name ?? ""),
      }))
      .filter((customer: CustomerOption) => customer.id && customer.name);
  }

  if (Array.isArray(raw?.data)) {
    return raw.data
      .map((customer: any) => ({
        id: String(customer?.id ?? ""),
        name: String(customer?.name ?? ""),
      }))
      .filter((customer: CustomerOption) => customer.id && customer.name);
  }

  return [];
}

function normalizeTimelinePayload(payload: unknown): TimelineEvent[] {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

  if (Array.isArray(raw)) {
    return raw as TimelineEvent[];
  }

  if (Array.isArray(raw?.items)) {
    return raw.items as TimelineEvent[];
  }

  if (Array.isArray(raw?.data)) {
    return raw.data as TimelineEvent[];
  }

  return [];
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
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
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
    return normalizeCustomersPayload(customersQuery.data);
  }, [customersQuery.data]);

  const events = useMemo(() => {
    return normalizeTimelinePayload(timelineQuery.data);
  }, [timelineQuery.data]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return events.filter((event) => {
      const inScope =
        scopeFilter === "ALL" || getEventScope(event) === scopeFilter;

      if (!inScope) return false;

      if (!term) return true;

      const action = getEventLabel(event).toLowerCase();
      const description = String(event.description ?? "").toLowerCase();
      const metadata = JSON.stringify(event.metadata ?? {}).toLowerCase();
      const summary = getEventSummary(event).toLowerCase();

      return (
        action.includes(term) ||
        description.includes(term) ||
        metadata.includes(term) ||
        summary.includes(term)
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
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
            <Sparkles className="h-3.5 w-3.5" />
            Auditoria operacional com leitura humana
          </div>

          <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <History className="h-6 w-6 text-orange-500" />
            Timeline
          </h1>

          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Aqui o sistema para de parecer tela solta e mostra a história da
            operação: agenda, execução, financeiro, risco e governança em ordem
            cronológica.
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
        </div>
      </div>

      {hasFatalError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {fatalErrorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <SummaryCard
          title="Eventos"
          value={stats.total}
          subtitle="Histórico visível"
        />
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
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
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

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Leitura rápida
              </h2>
            </div>

            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="font-medium text-gray-900 dark:text-white">
                  Agenda → execução
                </p>
                <p className="mt-1">
                  Veja se o histórico está parando em agendamento ou realmente
                  puxando O.S.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="font-medium text-gray-900 dark:text-white">
                  Execução → financeiro
                </p>
                <p className="mt-1">
                  O ponto crítico é serviço concluído sem cobrança ou com
                  cobrança vencida.
                </p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
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

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
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
                const summary = getEventSummary(event);
                const nextAction = getNextAction(event);
                const metadata = (event.metadata ?? {}) as Record<string, unknown>;
                const serviceOrderId = getMetadataId(metadata, "serviceOrderId");
                const chargeId = getMetadataId(metadata, "chargeId");

                return (
                  <div
                    key={event.id}
                    className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getEventTone(
                              event.action ?? event.type
                            )}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {getEventLabel(event)}
                          </span>

                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <User className="h-3 w-3" />
                            Evento #{event.id.slice(0, 8)}
                          </span>

                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {filters.find((item) => item.value === getEventScope(event))
                              ?.label ?? "Contexto"}
                          </span>
                        </div>

                        <p className="mt-3 text-sm text-gray-900 dark:text-white">
                          {event.description?.trim() || "Sem descrição."}
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

                    {(serviceOrderId || chargeId) && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {serviceOrderId ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(buildServiceOrdersDeepLink(serviceOrderId))
                            }
                            className="gap-2"
                          >
                            <Wrench className="h-4 w-4" />
                            Abrir O.S.
                          </Button>
                        ) : null}

                        {chargeId ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(buildFinanceChargeUrl(chargeId))}
                            className="gap-2"
                          >
                            <Wallet className="h-4 w-4" />
                            Abrir cobrança
                          </Button>
                        ) : null}

                        {selectedCustomer ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate(`/customers?customerId=${selectedCustomer.id}`)
                            }
                            className="gap-2"
                          >
                            <Users className="h-4 w-4" />
                            Abrir cliente
                          </Button>
                        ) : null}

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(`/timeline?customerId=${selectedCustomer?.id ?? ""}`)
                          }
                          className="gap-2"
                        >
                          <Link2 className="h-4 w-4" />
                          Deep-link
                        </Button>
                      </div>
                    )}

                    {showMetadata && event.metadata ? (
                      <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
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
    </div>
  );
}
