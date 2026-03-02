import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Plus, Loader } from "lucide-react";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { toast } from "sonner";

interface Appointment {
  id: number;
  customerId: number;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  notes: string | null;
  createdAt: Date;
}

export default function AppointmentsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([]);

  // Queries
  const listAppointments = trpc.data.appointments.list.useQuery(undefined);
  const listCustomers = trpc.data.customers.list.useQuery(undefined);

  useEffect(() => {
    if (listAppointments.data) {
      setAppointments(listAppointments.data as unknown as Appointment[]);
    }
  }, [listAppointments.data]);

  useEffect(() => {
    if (listAppointments.error) {
      toast.error("Erro ao carregar agendamentos: " + listAppointments.error.message);
    }
  }, [listAppointments.error]);

  useEffect(() => {
    if (listCustomers.data) {
      setCustomers(
        (listCustomers.data as unknown as Array<{ id: number; name: string }>).map((c: any) => ({
          id: c.id,
          name: c.name,
        }))
      );
    }
  }, [listCustomers.data]);

  const handleCreateSuccess = () => {
    void listAppointments.refetch();
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const formatDateTime = (date: Date | string) => {
    return new Date(date).toLocaleString("pt-BR");
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      CONFIRMED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      CANCELED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      DONE: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      NO_SHOW: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const columns: Array<{
    key: keyof Appointment;
    label: string;
    sortable?: boolean;
    render?: (value: any) => React.ReactNode;
  }> = [
    {
      key: "title" as const,
      label: "Título",
      sortable: true,
    },
    {
      key: "startsAt" as const,
      label: "Data/Hora",
      sortable: true,
      render: (value: any) => formatDateTime(value),
    },
    {
      key: "status" as const,
      label: "Status",
      sortable: true,
      render: (value: any) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value}
        </span>
      ),
    },
    {
      key: "createdAt" as const,
      label: "Criado em",
      render: (value: any) => formatDate(value),
    },
  ];

  if (listAppointments.isLoading && appointments.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Agendamentos
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie todos os seus agendamentos
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Agendamento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total de Agendamentos
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {appointments.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Agendados
          </p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
            {appointments.filter((a) => a.status === "SCHEDULED").length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Confirmados
          </p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
            {appointments.filter((a) => a.status === "CONFIRMED").length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Concluídos
          </p>
          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
            {appointments.filter((a) => a.status === "DONE").length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <DataTable
          columns={columns}
          data={appointments}
          loading={false}
          searchable={true}
          searchFields={["title", "description"]}
          emptyMessage="Nenhum agendamento cadastrado. Crie o primeiro clicando em 'Novo Agendamento'."
        />
      </div>

      {/* Modal */}
      <CreateAppointmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        customers={customers}
      />
    </div>
  );
}
