import { useEffect, useMemo, useState } from "react";
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
  CalendarDays,
  CircleDashed,
  CircleOff,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { toast } from "sonner";

type CustomerRef = {
  id: string;
  name: string;
  phone?: string | null;
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
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
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
          "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300",
        icon: CircleDashed,
      };
    case "CONFIRMED":
      return {
        label: "Pronto para execução",
        description: "O cliente confirmou e o agendamento já pode virar operação.",
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
        description: "O cliente não compareceu e o fluxo precisa de tratamento.",
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
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}

export default function AppointmentsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

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

  const updateAppointment = trpc.nexo.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Agendamento atualizado com sucesso!");
      void listAppointments.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar agendamento");
    },
    onSettled: () => {
      setProcessingId(null);
    },
  });

  const appointments = useMemo(() => {
    const payload = listAppointments.data;
    const rows = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];

    return rows as Appointment[];
  }, [listAppointments.data]);

  const customers = useMemo(() => {
    const payload = listCustomers.data;
    const rows = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
        ? payload
        : [];

    return rows.map((customer: any) => ({
      id: String(customer.id),
      name: String(customer.name),
    }));
  }, [listCustomers.data]);

  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return appointments.filter((appointment) => {
      if (!q) return true;

      return (
        String(appointment.customer?.name ?? "")
          .toLowerCase()
          .includes(q) ||
        String(appointment.notes ?? "")
          .toLowerCase()
          .includes(q) ||
        String(getStatusLabel(appointment.status))
          .toLowerCase()
          .includes(q)
      );
    });
  }, [appointments, searchQuery]);

  useEffect(() => {
    if (listAppointments.error) {
      toast.error("Erro ao carregar agendamentos: " + listAppointments.error.message);
    }
  }, [listAppointments.error]);

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

  const handleCreateSuccess = () => {
    void listAppointments.refetch();
  };

  const handleUpdateStatus = async (
    appointmentId: string,
    status: AppointmentStatus
  ) => {
    setProcessingId(appointmentId);

    try {
      await updateAppointment.mutateAsync({
        id: appointmentId,
        data: { status },
      });
    } catch {
      // toast já tratado no mutation
    }
  };

  const handleApplySearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleClearLocalFilters = () => {
    setSearchInput("");
    setSearchQuery("");
  };

  const hasLocalFilters = Boolean(searchQuery);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
            <Calendar className="h-8 w-8 text-orange-500" />
            Agendamentos
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Leitura operacional dos compromissos, confirmações, conclusões e perdas do dia a dia.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void listAppointments.refetch()}
            className="gap-2"
          >
            <RefreshCcw className="h-4 w-4" />
            Atualizar
          </Button>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="gap-2 bg-orange-500 text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        </div>
      </div>

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

      {hasLocalFilters ? (
        <div className="flex flex-wrap gap-2 text-sm text-gray-500">
          <span className="rounded-full border px-3 py-1">
            Busca local: {searchQuery}
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
            {total}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Agendados</p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {totalScheduled}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Confirmados</p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
            {totalConfirmed}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Concluídos</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {totalDone}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">No-show</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {totalNoShow}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Cancelados</p>
          <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
            {totalCanceled}
          </p>
        </div>
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

            return (
              <div
                key={appointment.id}
                className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
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
                        variant="outline"
                        className="gap-2"
                        onClick={() =>
                          void handleUpdateStatus(appointment.id, "CONFIRMED")
                        }
                        disabled={
                          isProcessing ||
                          updateAppointment.isPending ||
                          appointment.status !== "SCHEDULED"
                        }
                      >
                        <CheckCheck className="h-4 w-4" />
                        Confirmar
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
        <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
          <p>
            {appointments.length === 0
              ? "Nenhum agendamento encontrado"
              : "Nenhum agendamento corresponde aos filtros locais"}
          </p>
        </div>
      )}

      <CreateAppointmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        customers={customers}
      />
    </div>
  );
}
