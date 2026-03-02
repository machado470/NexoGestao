import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { Plus, Loader, Package } from "lucide-react";
import { CreateServiceOrderModal } from "@/components/CreateServiceOrderModal";
import { toast } from "sonner";

interface ServiceOrder {
  id: number;
  customerId: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assignedTo: string | null;
  notes: string | null;
  createdAt: Date;
}

interface PaginatedResponse {
  data: ServiceOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function ServiceOrdersPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Queries
  const listServiceOrders = trpc.data.serviceOrders.list.useQuery({ page, limit });
  const listCustomers = trpc.data.customers.list.useQuery({ page: 1, limit: 1000 });

  useEffect(() => {
    if (listServiceOrders.data) {
      const response = listServiceOrders.data as unknown as PaginatedResponse;
      setServiceOrders(response.data);
      setPagination(response.pagination);
    }
  }, [listServiceOrders.data]);

  useEffect(() => {
    if (listCustomers.data) {
      const response = listCustomers.data as any;
      setCustomers(response.data || []);
    }
  }, [listCustomers.data]);

  useEffect(() => {
    if (listServiceOrders.error) {
      toast.error("Erro ao carregar ordens de serviço: " + listServiceOrders.error.message);
    }
  }, [listServiceOrders.error]);

  const handleCreateSuccess = () => {
    void listServiceOrders.refetch();
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      URGENT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return colors[priority] || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      ASSIGNED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      IN_PROGRESS: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
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
            <Package className="w-8 h-8 text-orange-500" />
            Ordens de Serviço
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie todas as suas ordens de serviço
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Ordem
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
          <p className="text-sm text-gray-600 dark:text-gray-400">Abertas</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
            {serviceOrders.filter((o) => o.status === "OPEN").length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Em Progresso</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
            {serviceOrders.filter((o) => o.status === "IN_PROGRESS").length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Concluídas</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {serviceOrders.filter((o) => o.status === "DONE").length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {listServiceOrders.isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : serviceOrders.length > 0 ? (
          <>
            <DataTable
              columns={[
                { key: "title", label: "Título", sortable: true },
                {
                  key: "priority",
                  label: "Prioridade",
                  render: (value) => (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(value as string)}`}>
                      {value}
                    </span>
                  ),
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
              data={serviceOrders}
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
            <p>Nenhuma ordem de serviço encontrada</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <CreateServiceOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        customers={customers}
      />
    </div>
  );
}
