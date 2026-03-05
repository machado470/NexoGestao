import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { Plus, Loader, Calendar } from "lucide-react";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { toast } from "sonner";

interface Appointment {
  id: string;
  customerId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  notes: string | null;
  createdAt: Date;
}

interface PaginatedResponse {
  data: Appointment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function AppointmentsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  // Queries
  const listAppointments = trpc.data.appointments.list.useQuery({ page, limit });
  const listCustomers = trpc.data.customers.list.useQuery({ page: 1, limit: 1000 });

  useEffect(() => {
    if (listAppointments.data) {
      const response = listAppointments.data as unknown as PaginatedResponse;
      if (response && response.data && response.pagination) {
        setAppointments(response.data);
        setPagination(response.pagination);
      }
    }
  }, [listAppointments.data]);

  useEffect(() => {
    if (listCustomers.data) {
      const response = listCustomers.data as any;
      if (response && response.data && Array.isArray(response.data)) {
        setCustomers(response.data);
      }
    }
  }, [listCustomers.data]);

  useEffect(() => {
    if (listAppointments.error) {
      toast.error("Erro ao carregar agendamentos: " + listAppointments.error.message);
    }
  }, [listAppointments.error]);

  const handleCreateSuccess = () => {
    void listAppointments.refetch();
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      CONFIRMED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      NO_SHOW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      CANCELED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return colors[status] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-8 h-8 text-orange-500" />
            Agendamentos
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie todos os seus agendamentos
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {pagination.total}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Agendados</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {appointments.filter((a) => a.status === "SCHEDULED").length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Em Progresso</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
            {appointments.filter((a) => a.status === "NO_SHOW").length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Concluídos</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {appointments.filter((a) => a.status === "DONE").length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {listAppointments.isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : appointments.length > 0 ? (
          <>
            <DataTable
              columns={[
                { key: "title", label: "Título", sortable: true },
                {
                  key: "startsAt",
                  label: "Data/Hora",
                  render: (value) => new Date(value as string).toLocaleString("pt-BR"),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (value) => (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value as string)}`}>
                      {value}
                    </span>
                  ),
                },
              ]}
              data={appointments}
              onEdit={() => {}}
              onDelete={() => {}}
            />
            <Pagination
              page={pagination.page}
              pages={pagination.pages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <p>Nenhum agendamento encontrado</p>
          </div>
        )}
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
