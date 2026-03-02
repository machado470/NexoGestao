import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Plus, Loader } from "lucide-react";
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

export default function ServiceOrdersPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: number; name: string }>>([]);

  // Queries
  const listServiceOrders = trpc.data.serviceOrders.list.useQuery(undefined);
  const listCustomers = trpc.data.customers.list.useQuery(undefined);

  useEffect(() => {
    if (listServiceOrders.data) {
      setServiceOrders(listServiceOrders.data as unknown as ServiceOrder[]);
    }
  }, [listServiceOrders.data]);

  useEffect(() => {
    if (listServiceOrders.error) {
      toast.error("Erro ao carregar ordens de serviço: " + listServiceOrders.error.message);
    }
  }, [listServiceOrders.error]);

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
    void listServiceOrders.refetch();
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      URGENT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return colors[priority] || "bg-gray-100 text-gray-800";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      ASSIGNED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      IN_PROGRESS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      DONE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      CANCELED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const columns: Array<{
    key: keyof ServiceOrder;
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
      key: "priority" as const,
      label: "Prioridade",
      sortable: true,
      render: (value: any) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(value)}`}>
          {value}
        </span>
      ),
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
      key: "assignedTo" as const,
      label: "Atribuído a",
      render: (value: any) => value || "-",
    },
    {
      key: "createdAt" as const,
      label: "Criado em",
      render: (value: any) => formatDate(value),
    },
  ];

  if (listServiceOrders.isLoading && serviceOrders.length === 0) {
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
            Ordens de Serviço
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie todas as suas ordens de serviço
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Ordem
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total de Ordens
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {serviceOrders.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Abertas
          </p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
            {serviceOrders.filter((s) => s.status === "OPEN").length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Em Progresso
          </p>
          <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-2">
            {serviceOrders.filter((s) => s.status === "IN_PROGRESS").length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Concluídas
          </p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
            {serviceOrders.filter((s) => s.status === "DONE").length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Urgentes
          </p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
            {serviceOrders.filter((s) => s.priority === "URGENT").length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <DataTable
          columns={columns}
          data={serviceOrders}
          loading={false}
          searchable={true}
          searchFields={["title", "description"]}
          emptyMessage="Nenhuma ordem de serviço cadastrada. Crie a primeira clicando em 'Nova Ordem'."
        />
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
