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
} from "lucide-react";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { toast } from "sonner";

type CustomerRef = {
  id: string;
  name: string;
  phone?: string | null;
};

type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "DONE" | "CANCELED" | "NO_SHOW";

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

function truncateText(value?: string | null, max = 60) {
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

export default function AppointmentsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "">("");
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

  useEffect(() => {
    if (listAppointments.error) {
      toast.error("Erro ao carregar agendamentos: " + listAppointments.error.message);
    }
  }, [listAppointments.error]);

  const total = appointments.length;
  const totalScheduled = appointments.filter((a) => a.status === "SCHEDULED").length;
  const totalConfirmed = appointments.filter((a) => a.status === "CONFIRMED").length;
  const totalDone = appointments.filter((a) => a.status === "DONE").length;

  const handleCreateSuccess = () => {
    void listAppointments.refetch();
  };

  const handleUpdateStatus = async (appointmentId: string, status: AppointmentStatus) => {
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-white">
            <Calendar className="h-8 w-8 text-orange-500" />
            Agendamentos
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Gerencie os agendamentos operacionais da sua base.
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Lista</p>
        </div>

        {listAppointments.isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : appointments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Cliente
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Início
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Fim
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Observações
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {appointments.map((appointment) => {
                  const isProcessing = processingId === appointment.id;

                  return (
                    <tr
                      key={appointment.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/30"
                    >
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {appointment.customer?.name ?? "Cliente não identificado"}
                      </td>

                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {formatDateTime(appointment.startsAt)}
                      </td>

                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {formatDateTime(appointment.endsAt)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                            appointment.status
                          )}`}
                        >
                          {getStatusLabel(appointment.status)}
                        </span>
                      </td>

                      <td
                        className="max-w-[280px] px-4 py-3 text-gray-700 dark:text-gray-300"
                        title={appointment.notes ?? ""}
                      >
                        {truncateText(appointment.notes)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={() => void handleUpdateStatus(appointment.id, "CONFIRMED")}
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
                            onClick={() => void handleUpdateStatus(appointment.id, "DONE")}
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
                            onClick={() => void handleUpdateStatus(appointment.id, "NO_SHOW")}
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
                            onClick={() => void handleUpdateStatus(appointment.id, "CANCELED")}
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
            <p>Nenhum agendamento encontrado</p>
          </div>
        )}
      </div>

      <CreateAppointmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        customers={customers}
      />
    </div>
  );
}
