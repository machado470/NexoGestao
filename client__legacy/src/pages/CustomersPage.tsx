import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { Plus, Loader, Users } from "lucide-react";
import { CreateCustomerModal } from "@/components/CreateCustomerModal";
import { EditCustomerModal } from "@/components/EditCustomerModal";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { ContactHistoryModal } from "@/components/ContactHistoryModal";
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

interface PaginatedResponse {
  data: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function CustomersPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  // Queries
  const listCustomers = trpc.data.customers.list.useQuery({ page, limit });

  useEffect(() => {
    if (listCustomers.data) {
      const response = listCustomers.data as unknown as PaginatedResponse;
      if (response && response.data && response.pagination) {
        setCustomers(response.data);
        setPagination(response.pagination);
      }
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
    },
    onError: (error) => {
      toast.error("Erro ao deletar cliente: " + error.message);
    },
  });

  const handleDeleteClick = (row: Customer) => {
    setSelectedCustomerId(row.id);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedCustomerId) {
      await deleteCustomer.mutateAsync({ id: selectedCustomerId });
    }
  };

  const handleEditClick = (row: Customer) => {
    setSelectedCustomerId(row.id);
    setShowEditModal(true);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-8 h-8 text-orange-500" />
            Clientes
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie todos os seus clientes em um único lugar
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total de Clientes</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {pagination.total}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Ativos</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {customers.filter((c) => c.active === 1).length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">Inativos</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {customers.filter((c) => c.active === 0).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {listCustomers.isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : customers.length > 0 ? (
          <>
            <DataTable
              columns={[
                { key: "name", label: "Nome", sortable: true },
                { key: "email", label: "Email", sortable: true },
                { key: "phone", label: "Telefone", sortable: true },
                {
                  key: "active",
                  label: "Status",
                  render: (value) => (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        value === 1
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {value === 1 ? "Ativo" : "Inativo"}
                    </span>
                  ),
                },
                {
                  key: "id" as any,
                  label: "Contatos",
                  render: (_, row: any) => (
                    <ContactHistoryModal
                      customerId={row.id}
                      customerName={row.name}
                      trigger={
                        <Button variant="outline" size="sm" className="text-xs">
                          Ver Historico
                        </Button>
                      }
                    />
                  ),
                },
              ]}
              data={customers}
              onEdit={(row) => handleEditClick(row as Customer)}
              onDelete={(row) => handleDeleteClick(row as Customer)}
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
            <p>Nenhum cliente encontrado</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateCustomerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      {selectedCustomerId && (
        <>
          <EditCustomerModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            customerId={selectedCustomerId}
            onSuccess={handleCreateSuccess}
          />

          <ConfirmDeleteModal
            isOpen={showDeleteModal}
            onCancel={() => setShowDeleteModal(false)}
            onConfirm={handleConfirmDelete}
            title="Deletar Cliente"
            message="Tem certeza que deseja deletar este cliente?"
            isLoading={deleteCustomer.isPending}
          />
        </>
      )}
    </div>
  );
}
