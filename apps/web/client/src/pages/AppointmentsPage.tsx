import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Loader,
  Calendar,
  RefreshCcw,
  CheckCircle2,
  Ban,
  Clock3,
  CheckCheck,
  Search,
  X,
  CircleDashed,
  CircleOff,
  UserCheck,
  AlertTriangle,
  Link2,
  MessageCircle,
  Briefcase,
  Users,
  ArrowRight,
  Wallet,
} from "lucide-react";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { toast } from "sonner";
import {
  buildServiceOrdersDeepLink,
  buildWhatsAppConversationUrl,
  normalizeOrders,
} from "@/lib/operations/operations.utils";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { PageHero, PageShell, SmartPage } from "@/components/PagePattern";
import { DemoEnvironmentCta } from "@/components/DemoEnvironmentCta";

type CustomerRef = {
  id: string;
  name: string;
  phone?: string | null;
};

type CustomerOption = {
  id: string;
  name: string;
};

type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "DONE"
  | "CANCELED"
  | "NO_SHOW";

type Appointment = {
  id: string;
  customerId: string;
  customer?: CustomerRef | null;
  startsAt: string;
  endsAt: string | null;
  status: AppointmentStatus;
  notes: string | null;
  createdAt?: string;
};

type ServiceOrder = {
  id: string;
  customerId?: string | null;
  title?: string | null;
  status?: string | null;
  createdAt?: string | null;
  financialSummary?: {
    hasCharge?: boolean;
    chargeStatus?: string | null;
  } | null;
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

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(value?: string | null, max = 80) {
  const text = (value ?? "").trim();
  if (!text) return "—";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function getStatusLabel(status: AppointmentStatus) {
  const labels: Record<AppointmentStatus, string> = {
    SCHEDULED: "Agendado",
    CONFIRMED: "Confirmado",
    DONE: "Concluído",
    CANCELED: "Cancelado",
    NO_SHOW: "Não compareceu",
  };

  return labels[status] ?? status;
}

function getStatusColor(status: AppointmentStatus) {
  const colors: Record<AppointmentStatus, string> = {
    SCHEDULED:
      "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
    CONFIRMED:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    DONE:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    CANCELED:
      "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    NO_SHOW:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  };

  return colors[status];
}

function getStage(appointment: Appointment) {
  switch (appointment.status) {
    case "SCHEDULED":
      return {
        label: "Aguardando confirmação",
        description: "O horário foi criado, mas ainda depende de confirmação.",
        className:
          "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-200",
        icon: CircleDashed,
      };
    case "CONFIRMED":
      return {
        label: "Pronto para execução",
        description:
          "O cliente confirmou e o agendamento já pode virar operação.",
        className:
          "border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
        icon: UserCheck,
      };
    case "DONE":
      return {
        label: "Ciclo do agendamento concluído",
        description: "O compromisso foi realizado com sucesso.",
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300",
        icon: CheckCircle2,
      };
    case "NO_SHOW":
      return {
        label: "Perdido por ausência",
        description:
          "O cliente não compareceu e o fluxo precisa de tratamento.",
        className:
          "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-300",
        icon: AlertTriangle,
      };
    case "CANCELED":
    default:
      return {
        label: "Agendamento cancelado",
        description: "O compromisso foi encerrado antes da execução.",
        className:
          "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
        icon: CircleOff,
      };
  }
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="nexo-subtle-surface p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
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
      <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
      <p
        className={`mt-1 text-2xl font-bold text-gray-900 dark:text-white ${
          valueClassName ?? ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {subtitle}
      </p>
    </div>
  );
}

function getAppointmentIdFromUrl() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const appointmentId = params.get("appointmentId")?.trim() ?? "";

  return appointmentId || null;
}

function getCustomerIdFromUrl() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const customerId = params.get("customerId")?.trim() ?? "";

  return customerId || null;
}

function buildAppointmentsUrl(
  appointmentId?: string | null,
  customerId?: string | null
) {
  const params = new URLSearchParams();

  if (appointmentId) {
    params.set("appointmentId", appointmentId);
  }
  if (customerId) {
    params.set("customerId", customerId);
  }

  const query = params.toString();
  return query ? `/appointments?${query}` : "/appointments";
}

function buildCustomersUrl(customerId?: string | null) {
  if (!customerId) return "/customers";
  return `/customers?customerId=${customerId}`;
}

function normalizeServiceOrdersPayload(data: unknown) {
  return normalizeOrders<ServiceOrder>(data);
}

function getAppointmentNextAction(params: {
  appointment: Appointment;
  serviceOrders: ServiceOrder[];
}) {
  const { appointment, serviceOrders } = params;
  const customerOrders = serviceOrders.filter(
    (item) => String(item.customerId ?? "") === appointment.customerId
  );

  const latestOrder = customerOrders[0] ?? null;
  const hasOrder = customerOrders.length > 0;
  const hasPendingCharge = customerOrders.some((order) => {
    const status = String(order.financialSummary?.chargeStatus ?? "").toUpperCase();
    return status === "PENDING" || status === "OVERDUE";
  });

  if (appointment.status === "CANCELED") {
    return {
      tone:
        "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
      title: "Fluxo encerrado",
      description: "Agendamento cancelado. Nenhuma ação operacional imediata.",
    };
  }

  if (appointment.status === "NO_SHOW") {
    return {
      tone:
        "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-950/20 dark:text-yellow-300",
      title: "Retomar contato",
      description:
        "Cliente não compareceu. Vale reabrir conversa e tentar remarcar.",
    };
  }

  if (appointment.status === "SCHEDULED") {
    return {
      tone:
        "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-200",
      title: "Confirmar o horário",
      description:
        "O próximo passo é validar presença e reduzir risco de ausência.",
    };
  }

  if (appointment.status === "CONFIRMED" && !hasOrder) {
    return {
      tone:
        "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300",
      title: "Abrir execução",
      description:
        "Cliente confirmado sem O.S. vinculada visível. Hora de puxar a operação.",
    };
  }

  if (appointment.status === "CONFIRMED" && hasOrder) {
    return {
      tone:
        "border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-300",
      title: "Acompanhar O.S.",
      description: latestOrder
        ? "Já existe operação em andamento para este cliente. Use a ordem como hub."
        : "Cliente confirmado com operação em andamento.",
    };
  }

  if (appointment.status === "DONE" && hasPendingCharge) {
    return {
      tone:
        "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300",
      title: "Fechar financeiro",
      description:
        "Atendimento concluído, mas ainda existem pendências financeiras pedindo ação.",
    };
  }

  if (appointment.status === "DONE" && hasOrder) {
    return {
      tone:
        "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300",
      title: "Fluxo em acompanhamento",
      description:
        "Agendamento concluído. Agora a leitura correta é acompanhar operação e financeiro.",
    };
  }

  return {
    tone:
      "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
    title: "Sem ação imediata",
    description: "Nenhum próximo passo crítico identificado no momento.",
  };
}

export default function AppointmentsPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string | null>(() =>
    getCustomerIdFromUrl()
  );
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [routingActionId, setRoutingActionId] = useState<string | null>(null);
  const [successActionId, setSuccessActionId] = useState<string | null>(null);
  const [highlightedAppointmentId, setHighlightedAppointmentId] = useState<
    string | null
  >(() => getAppointmentIdFromUrl());

  const appointmentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const listAppointments = trpc.nexo.appointments.list.useQuery(
    statusFilter ? { status: statusFilter } : undefined,
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const listCustomers = trpc.nexo.customers.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const listServiceOrders = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 100 },
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const updateAppointment = trpc.nexo.appointments.update.useMutation({
    onMutate: async (variables) => {
      const previous = listAppointments.data;
      const targetId = String(variables.id);
      const targetStatus = String(variables.status ?? "");

      utils.nexo.appointments.list.setData(
        statusFilter ? { status: statusFilter } : undefined,
        (old: any) => {
          const raw = old as any[] | { data?: any[] } | undefined;
          const applyUpdate = (items: any[]) =>
            items.map((item) =>
              String(item?.id) === targetId ? { ...item, status: targetStatus } : item
            );
          if (Array.isArray(raw)) return applyUpdate(raw);
          if (raw && Array.isArray(raw.data)) return { ...raw, data: applyUpdate(raw.data) };
          return old;
        }
      );

      return { previous };
    },
    onSuccess: () => {
      toast.success("Agendamento atualizado com sucesso!");
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        utils.nexo.appointments.list.setData(
          statusFilter ? { status: statusFilter } : undefined,
          context.previous as any
        );
      }
      toast.error(error.message || "Erro ao atualizar agendamento");
    },
    onSettled: () => {
      setProcessingId(null);
      void utils.nexo.appointments.list.invalidate();
      void listServiceOrders.refetch();
    },
  });

  const appointments = useMemo(() => {
    return normalizeArrayPayload<Appointment>(listAppointments.data);
  }, [listAppointments.data]);

  const customers = useMemo(() => {
    return normalizeArrayPayload<CustomerOption>(listCustomers.data).map((customer) => ({
      id: String(customer.id),
      name: String(customer.name),
    }));
  }, [listCustomers.data]);

  const serviceOrders = useMemo(() => {
    return normalizeServiceOrdersPayload(listServiceOrders.data).sort((a, b) => {
      const dateA = new Date(a.createdAt ?? 0).getTime();
      const dateB = new Date(b.createdAt ?? 0).getTime();
      return dateB - dateA;
    });
  }, [listServiceOrders.data]);

  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return appointments.filter((appointment) => {
      if (
        customerFilter &&
        String(appointment.customerId ?? "") !== String(customerFilter)
      ) {
        return false;
      }

      if (!q) return true;

      return (
        String(appointment.customer?.name ?? "").toLowerCase().includes(q) ||
        String(appointment.notes ?? "").toLowerCase().includes(q) ||
        String(getStatusLabel(appointment.status)).toLowerCase().includes(q)
      );
    });
  }, [appointments, searchQuery, customerFilter]);

  const highlightedAppointment = useMemo(() => {
    if (!highlightedAppointmentId) return null;

    return (
      appointments.find(
        (appointment) => appointment.id === highlightedAppointmentId
      ) ?? null
    );
  }, [appointments, highlightedAppointmentId]);

  useEffect(() => {
    if (listAppointments.error) {
      toast.error(
        "Erro ao carregar agendamentos: " + listAppointments.error.message
      );
    }
  }, [listAppointments.error]);

  useEffect(() => {
    if (listServiceOrders.error) {
      toast.error(
        "Erro ao carregar ordens de serviço: " + listServiceOrders.error.message
      );
    }
  }, [listServiceOrders.error]);

  useEffect(() => {
    const syncFromUrl = () => {
      const appointmentIdFromUrl = getAppointmentIdFromUrl();
      const customerIdFromUrl = getCustomerIdFromUrl();
      setHighlightedAppointmentId((current) => {
        if (current === appointmentIdFromUrl) return current;
        return appointmentIdFromUrl;
      });
      setCustomerFilter((current) => {
        if (current === customerIdFromUrl) return current;
        return customerIdFromUrl;
      });
    };

    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);

    return () => {
      window.removeEventListener("popstate", syncFromUrl);
    };
  }, []);

  useEffect(() => {
    if (!highlightedAppointmentId) return;
    if (listAppointments.isLoading) return;

    const element = appointmentRefs.current[highlightedAppointmentId];
    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [highlightedAppointmentId, listAppointments.isLoading, filteredAppointments]);

  const total = filteredAppointments.length;
  const totalScheduled = filteredAppointments.filter(
    (a) => a.status === "SCHEDULED"
  ).length;
  const totalConfirmed = filteredAppointments.filter(
    (a) => a.status === "CONFIRMED"
  ).length;
  const totalDone = filteredAppointments.filter((a) => a.status === "DONE").length;
  const totalNoShow = filteredAppointments.filter(
    (a) => a.status === "NO_SHOW"
  ).length;
  const totalCanceled = filteredAppointments.filter(
    (a) => a.status === "CANCELED"
  ).length;

  const appointmentsWithOperations = filteredAppointments.filter((appointment) =>
    serviceOrders.some(
      (order) => String(order.customerId ?? "") === appointment.customerId
    )
  ).length;

  const appointmentsWithoutOperations =
    filteredAppointments.length - appointmentsWithOperations;


  const smartPriorities = useMemo(() => [
    {
      id: "appt-unconfirmed",
      type: "operational_risk" as const,
      title: "Agendamentos sem confirmação",
      count: totalScheduled,
      impactCents: totalScheduled * 18000,
      ctaLabel: "Confirmar agenda",
      ctaPath: "/appointments",
      helperText: "Sem confirmação o risco de no-show sobe.",
    },
    {
      id: "appt-no-os",
      type: "stalled_service_orders" as const,
      title: "Agendamentos sem O.S.",
      count: appointmentsWithoutOperations,
      impactCents: appointmentsWithoutOperations * 28000,
      ctaLabel: "Criar O.S.",
      ctaPath: "/service-orders",
      helperText: "Sem O.S. a agenda não vira entrega faturável.",
    },
    {
      id: "appt-fin",
      type: "overdue_charges" as const,
      title: "Concluídos com risco financeiro",
      count: totalDone,
      impactCents: totalDone * 12000,
      ctaLabel: "Ver financeiro",
      ctaPath: "/finances",
      helperText: "Concluir atendimento sem cobrança derruba conversão em caixa.",
    },
  ], [appointmentsWithoutOperations, totalDone, totalScheduled]);

  const handleCreateSuccess = () => {
    return;
  };

  const handleUpdateStatus = async (
    appointmentId: string,
    status: AppointmentStatus
  ) => {
    setProcessingId(appointmentId);

    try {
      await updateAppointment.mutateAsync({
        id: appointmentId,
        status,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Erro ao atualizar agendamento";
      toast.error(message);
      setProcessingId(null);
    }
  };

  const handleApplySearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleClearLocalFilters = () => {
    setSearchInput("");
    setSearchQuery("");
  };

  const handleOpenDeepLink = (appointmentId: string) => {
    setHighlightedAppointmentId(appointmentId);
    navigate(buildAppointmentsUrl(appointmentId, customerFilter), {
      replace: false,
    });
  };

  const handleClearDeepLink = () => {
    setHighlightedAppointmentId(null);
    navigate(buildAppointmentsUrl(null, customerFilter), { replace: false });
  };

  const hasLocalFilters = Boolean(searchQuery);

  return (
    <PageShell>
      <PageHero
        eyebrow="Porta de entrada da operação"
        title="Agendamentos"
        description="Aqui o cliente vira operação: confirme presença, puxe O.S. e mantenha o financeiro conectado sem depender de contexto interno."
        actions={<>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              Promise.all([
                listAppointments.refetch(),
                listServiceOrders.refetch(),
                listCustomers.refetch(),
              ])
            }
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </Button>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="min-h-12 gap-2 bg-orange-500 text-white"
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        </>}
      />


      <SmartPage
        pageContext="appointments"
        headline="Agenda com direção operacional"
        dominantProblem={appointmentsWithoutOperations > 0 ? "Agendamentos sem O.S. ativa" : "Agenda precisa de confirmação"}
        dominantImpact={`${appointmentsWithoutOperations} agendamentos sem execução`}
        dominantCta={{
          label: appointmentsWithoutOperations > 0 ? "Criar O.S. agora" : "Confirmar agenda",
          onClick: () => {
            const target = filteredAppointments.find((item) => item.status === "SCHEDULED") ?? filteredAppointments[0];
            if (target) handleOpenDeepLink(target.id);
          },
          path: "/appointments",
        }}
        priorities={smartPriorities}
      />

      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApplySearch();
            }}
            placeholder="Buscar por cliente, status ou observações"
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <Button onClick={handleApplySearch}>Buscar</Button>

        <Button
          variant="outline"
          onClick={handleClearLocalFilters}
          disabled={!hasLocalFilters && !searchInput}
        >
          <X className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      </div>

      {highlightedAppointmentId ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300">
            Deep-link ativo:{" "}
            {highlightedAppointment?.customer?.name ?? highlightedAppointmentId}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearDeepLink}
          >
            Limpar foco
          </Button>
        </div>
      ) : null}

      {hasLocalFilters ? (
        <div className="flex flex-wrap gap-2 text-sm text-gray-500">
          <span className="rounded-full border px-3 py-1">
            Busca local: {searchQuery}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total"
          value={total}
          subtitle="Agendamentos visíveis"
        />
        <SummaryCard
          title="Agendados"
          value={totalScheduled}
          subtitle="Ainda sem confirmação"
          valueClassName="text-orange-600 dark:text-orange-300"
        />
        <SummaryCard
          title="Confirmados"
          value={totalConfirmed}
          subtitle="Prontos para operar"
          valueClassName="text-green-600 dark:text-green-400"
        />
        <SummaryCard
          title="Concluídos"
          value={totalDone}
          subtitle="Ciclo de agenda encerrado"
          valueClassName="text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard
          title="Sem operação"
          value={appointmentsWithoutOperations}
          subtitle="Prioridade para criar O.S."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(["", "SCHEDULED", "CONFIRMED", "DONE", "CANCELED", "NO_SHOW"] as const).map(
          (status) => (
            <button
              key={status || "ALL"}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                statusFilter === status
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {status === "" ? "Todos" : getStatusLabel(status)}
            </button>
          )
        )}
      </div>

      {listAppointments.isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      ) : filteredAppointments.length > 0 ? (
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => {
            const isProcessing = processingId === appointment.id;
            const stage = getStage(appointment);
            const StageIcon = stage.icon;
            const isHighlighted = highlightedAppointmentId === appointment.id;

            const relatedOrders = serviceOrders.filter(
              (order) => String(order.customerId ?? "") === appointment.customerId
            );
            const latestOrder = relatedOrders[0] ?? null;
            const hasOperation = relatedOrders.length > 0;
            const hasPendingFinancial = relatedOrders.some((order) => {
              const chargeStatus = String(
                order.financialSummary?.chargeStatus ?? ""
              ).toUpperCase();
              return chargeStatus === "PENDING" || chargeStatus === "OVERDUE";
            });

            const nextAction = getAppointmentNextAction({
              appointment,
              serviceOrders,
            });
            const primaryAction =
              appointment.status === "SCHEDULED"
                ? {
                    label: "Confirmar",
                    icon: CheckCheck,
                    onClick: () => void handleUpdateStatus(appointment.id, "CONFIRMED"),
                    disabled: isProcessing || updateAppointment.isPending,
                  }
                : !hasOperation
                  ? {
                      label: "Criar O.S.",
                      icon: Briefcase,
                      onClick: () => {
                        setRoutingActionId(`create-${appointment.id}`);
                        navigate(
                          `/service-orders?customerId=${appointment.customerId}&appointmentId=${appointment.id}`
                        );
                        setSuccessActionId(`create-${appointment.id}`);
                        setTimeout(() => setRoutingActionId(null), 220);
                        setTimeout(() => setSuccessActionId(null), 1300);
                      },
                      disabled: false,
                    }
                  : {
                      label: "Abrir O.S.",
                      icon: Briefcase,
                      onClick: () => {
                        setRoutingActionId(`open-${appointment.id}`);
                        navigate(
                          latestOrder
                            ? buildServiceOrdersDeepLink(latestOrder.id)
                            : `/service-orders?customerId=${appointment.customerId}`
                        );
                        setSuccessActionId(`open-${appointment.id}`);
                        setTimeout(() => setRoutingActionId(null), 220);
                        setTimeout(() => setSuccessActionId(null), 1300);
                      },
                      disabled: false,
                    };
            const PrimaryActionIcon = primaryAction.icon;

            const whatsappUrl = buildWhatsAppConversationUrl({
              customerId: appointment.customerId,
              context:
                appointment.status === "NO_SHOW"
                  ? "general"
                  : appointment.status === "DONE" && hasPendingFinancial
                    ? "charge_pending"
                    : "general",
              serviceOrderId: latestOrder?.id ?? null,
            });

            return (
              <div
                key={appointment.id}
                ref={(element) => {
                  appointmentRefs.current[appointment.id] = element;
                }}
                className={`rounded-xl border bg-white p-4 transition-shadow hover:shadow-md dark:bg-gray-800 ${
                  isHighlighted
                    ? "border-orange-400 ring-2 ring-orange-200 dark:border-orange-500 dark:ring-orange-900/40"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                          {appointment.customer?.name ?? "Cliente não identificado"}
                        </h3>

                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                            appointment.status
                          )}`}
                        >
                          {getStatusLabel(appointment.status)}
                        </span>

                        {isHighlighted ? (
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                            Em foco
                          </span>
                        ) : null}

                        {hasOperation ? (
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                            Já puxou operação
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            Ainda sem O.S.
                          </span>
                        )}

                        {hasPendingFinancial ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            Pendência financeira
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {appointment.notes?.trim()
                          ? truncateText(appointment.notes, 120)
                          : "Sem observações operacionais para este agendamento."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="gap-2"
                        onClick={primaryAction.onClick}
                        disabled={primaryAction.disabled}
                      >
                        <PrimaryActionIcon className="h-4 w-4" />
                        {isProcessing
                          ? "Processando..."
                          : successActionId === `create-${appointment.id}` ||
                              successActionId === `open-${appointment.id}`
                            ? "Ação iniciada"
                            : routingActionId === `create-${appointment.id}` ||
                                routingActionId === `open-${appointment.id}`
                              ? "Abrindo..."
                              : primaryAction.label}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => handleOpenDeepLink(appointment.id)}
                      >
                        <Link2 className="h-4 w-4" />
                        Focar
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() =>
                          navigate(buildCustomersUrl(appointment.customerId))
                        }
                      >
                        <Users className="h-4 w-4" />
                        Cliente
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          if (!whatsappUrl) return;
                          setRoutingActionId(`wa-${appointment.id}`);
                          navigate(whatsappUrl);
                          setSuccessActionId(`wa-${appointment.id}`);
                          setTimeout(() => setRoutingActionId(null), 220);
                          setTimeout(() => setSuccessActionId(null), 1300);
                        }}
                        disabled={!whatsappUrl}
                      >
                        <MessageCircle className="h-4 w-4" />
                        {routingActionId === `wa-${appointment.id}`
                          ? "Abrindo..."
                          : successActionId === `wa-${appointment.id}`
                            ? "Conversa aberta"
                            : "WhatsApp"}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() =>
                          void handleUpdateStatus(appointment.id, "DONE")
                        }
                        disabled={
                          isProcessing ||
                          updateAppointment.isPending ||
                          !["SCHEDULED", "CONFIRMED"].includes(appointment.status)
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Concluir
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() =>
                          void handleUpdateStatus(appointment.id, "NO_SHOW")
                        }
                        disabled={
                          isProcessing ||
                          updateAppointment.isPending ||
                          !["SCHEDULED", "CONFIRMED"].includes(appointment.status)
                        }
                      >
                        <Clock3 className="h-4 w-4" />
                        No-show
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-2 text-red-600 hover:text-red-700"
                        onClick={() =>
                          void handleUpdateStatus(appointment.id, "CANCELED")
                        }
                        disabled={
                          isProcessing ||
                          updateAppointment.isPending ||
                          !["SCHEDULED", "CONFIRMED"].includes(appointment.status)
                        }
                      >
                        <Ban className="h-4 w-4" />
                        Cancelar
                      </Button>
                    </div>
                  </div>

                  <div className={`rounded-lg border p-3 ${stage.className}`}>
                    <div className="flex items-start gap-2">
                      <StageIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{stage.label}</p>
                        <p className="mt-1 text-xs opacity-90">
                          {stage.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={`rounded-lg border p-3 ${nextAction.tone}`}>
                    <div className="flex items-start gap-2">
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">
                          Próxima ação recomendada
                        </p>
                        <p className="mt-1 text-sm">{nextAction.title}</p>
                        <p className="mt-1 text-xs opacity-90">
                          {nextAction.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <InfoItem
                      label="Data"
                      value={formatDate(appointment.startsAt)}
                    />
                    <InfoItem
                      label="Início"
                      value={formatTime(appointment.startsAt)}
                    />
                    <InfoItem
                      label="Fim"
                      value={formatTime(appointment.endsAt)}
                    />
                    <InfoItem
                      label="Criado em"
                      value={formatDateTime(appointment.createdAt)}
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="nexo-subtle-surface p-3">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        <Briefcase className="h-3.5 w-3.5" />
                        Execução
                      </div>
                      <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        {hasOperation
                          ? latestOrder?.title?.trim() || "Operação vinculada"
                          : "Nenhuma O.S. visível"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {hasOperation
                          ? `Status: ${latestOrder?.status ?? "—"}`
                          : "Este agendamento ainda não virou hub de execução."}
                      </p>
                    </div>

                    <div className="nexo-subtle-surface p-3">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        <Wallet className="h-3.5 w-3.5" />
                        Financeiro
                      </div>
                      <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        {hasPendingFinancial
                          ? "Existe pendência"
                          : hasOperation
                            ? "Sem alerta crítico"
                            : "Ainda não puxado"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {hasPendingFinancial
                          ? "Há cobrança pendente ou vencida na operação deste cliente."
                          : hasOperation
                            ? "Nenhuma pressão financeira crítica detectada agora."
                            : "O financeiro nasce depois da execução."}
                      </p>
                    </div>

                    <div className="nexo-subtle-surface p-3">
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        <MessageCircle className="h-3.5 w-3.5" />
                        Comunicação
                      </div>
                      <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                        {appointment.customer?.phone
                          ? "Contato possível"
                          : "Telefone ausente"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {appointment.customer?.phone
                          ? "Use o WhatsApp como alavanca para confirmar, remarcar ou cobrar."
                          : "Sem telefone visível no payload atual para contato direto."}
                      </p>
                    </div>
                  </div>

                  {appointment.notes?.trim() ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                      <span className="font-medium text-gray-900 dark:text-white">
                        Observação completa:
                      </span>{" "}
                      {appointment.notes}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <p>
              {appointments.length === 0
                ? "Ainda não há agendamentos. Crie o primeiro para evidenciar o caminho até O.S., financeiro e WhatsApp."
                : "Nenhum agendamento bate com os filtros atuais. Limpe os filtros para retomar a leitura do fluxo."}
            </p>
          </div>
          {appointments.length === 0 ? <DemoEnvironmentCta /> : null}
        </div>
      )}

      <CreateAppointmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        customers={customers}
      />
    </PageShell>
  );
}
