import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Plus, Loader } from "lucide-react";
import { CreateCustomerModal } from "@/components/CreateCustomerModal";
import { EditCustomerModal } from "@/components/EditCustomerModal";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { toast } from "sonner";

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string;
  notes: string | null;
  active: number;
  createdAt: Date;
}

export default function CustomersPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Queries
  const listCustomers = trpc.data.customers.list.useQuery(undefined);

  useEffect(() => {
    if (listCustomers.data) {
      setCustomers(listCustomers.data as unknown as Customer[]);
    }
  }, [listCustomers.data]);

  useEffect(() => {
    if (listCustomers.error) {
      toast.error("Erro ao carregar clientes: " + listCustomers.error.message);
    }
  }, [listCustomers.error]);

  const handleCreateSuccess = () => {
    void listCustomers.refetch();
  };

  const deleteCustomer = trpc.data.customers.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente deletado com sucesso!");
      void listCustomers.refetch();
      setShowDeleteModal(false);
      setSelectedCustomerId(null);
    },
    onError: (error) => {
      toast.error("Erro ao deletar cliente: " + error.message);
    },
  });

  const handleEdit = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setShowEditModal(true);
  };

  const handleDelete = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedCustomerId) {
      deleteCustomer.mutate({ id: selectedCustomerId });
    }
  };

    const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const columns: Array<{
    key: keyof Customer;
    label: string;
    sortable?: boolean;
    render?: (value: any) => React.ReactNode;
  }> = [
    {
      key: "name" as const,
      label: "Nome",
      sortable: true,
    },
    {
      key: "email" as const,
      label: "Email",
      sortable: true,
    },
    {
      key: "phone" as const,
      label: "Telefone",
      sortable: false,
    },
    {
      key: "active" as const,
      label: "Status",
      render: (value: any) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            value
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
          }`}
        >
          {value ? "Ativo" : "Inativo"}
        </span>
      ),
    },
    {
      key: "createdAt" as const,
      label: "Data de Criação",
      render: (value: any) => formatDate(value),
    },
  ];

  if (listCustomers.isLoading && customers.length === 0) {
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
            Clientes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie todos os seus clientes
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total de Clientes
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {customers.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Clientes Ativos
          </p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
            {customers.filter((c) => c.active).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Clientes Inativos
          </p>
          <p className="text-3xl font-bold text-gray-600 dark:text-gray-400 mt-2">
            {customers.filter((c) => !c.active).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <DataTable
          columns={columns}
          data={customers}
          loading={false}
          searchable={true}
          searchFields={["name", "email", "phone"]}
          emptyMessage="Nenhum cliente cadastrado. Crie o primeiro clicando em 'Novo Cliente'."
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      {/* Modals */}
      <CreateCustomerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
      <EditCustomerModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleCreateSuccess}
        customerId={selectedCustomerId}
      />
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        title="Deletar Cliente"
        message="Tem certeza que deseja deletar este cliente? Todos os agendamentos e ordens de serviço associados também serão deletados."
        itemName={customers.find((c) => c.id === selectedCustomerId)?.name}
        isLoading={deleteCustomer.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
