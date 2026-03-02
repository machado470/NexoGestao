import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  Edit2,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  Loader,
} from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { CreateLaunchModal } from "@/components/CreateLaunchModal";
import { toast } from "sonner";

interface Launch {
  id: number;
  organizationId?: number;
  chargeId?: number | null;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: string;
  dueDate: Date;
  paidDate: Date | null;
  status: "pending" | "paid" | "overdue" | "canceled";
  paymentMethod: string | null;
  notes: string | null;
  createdBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function LaunchesPage() {
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState<"income" | "expense" | undefined>();
  const [filterStatus, setFilterStatus] = useState<
    "pending" | "paid" | "overdue" | "canceled" | undefined
  >();

  const launchesQuery = trpc.launches.list.useQuery({
    page,
    limit: 20,
    type: filterType,
    status: filterStatus,
  });

  const deleteMutation = trpc.launches.delete.useMutation({
    onSuccess: () => {
      toast.success("Lançamento deletado com sucesso!");
      void launchesQuery.refetch();
    },
    onError: (error) => {
      toast.error("Erro ao deletar lançamento: " + error.message);
    },
  });

  const handleCreateSuccess = () => {
    void launchesQuery.refetch();
  };

  const summaryQuery = trpc.launches.summary.useQuery({});

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja deletar este lançamento?")) {
      deleteMutation.mutate({ id });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      canceled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getTypeIcon = (type: string) => {
    return type === "income" ? (
      <ArrowUpRight className="w-4 h-4 text-green-500" />
    ) : (
      <ArrowDownLeft className="w-4 h-4 text-red-500" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Lançamentos
        </h1>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Lançamento
        </Button>
      </div>

      {/* Summary Cards */}
      {summaryQuery.data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Receita Total
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              R$ {(summaryQuery.data.income / 100).toFixed(2)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Despesa Total
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              R$ {(summaryQuery.data.expenses / 100).toFixed(2)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Receita Pendente
            </p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              R$ {(summaryQuery.data.pendingIncome / 100).toFixed(2)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Saldo
            </p>
            <p
              className={`text-2xl font-bold ${
                summaryQuery.data.balance >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              R$ {(summaryQuery.data.balance / 100).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateLaunchModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filtros:
          </span>
        </div>

        <select
          value={filterType || ""}
          onChange={(e) =>
            setFilterType((e.target.value as "income" | "expense") || undefined)
          }
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">Todos os tipos</option>
          <option value="income">Receita</option>
          <option value="expense">Despesa</option>
        </select>

        <select
          value={filterStatus || ""}
          onChange={(e) =>
            setFilterStatus(
              (e.target.value as
                | "pending"
                | "paid"
                | "overdue"
                | "canceled") || undefined
            )
          }
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
          <option value="overdue">Vencido</option>
          <option value="canceled">Cancelado</option>
        </select>

        <Button
          variant="outline"
          onClick={() => {
            setFilterType(undefined);
            setFilterStatus(undefined);
          }}
          className="text-sm"
        >
          Limpar Filtros
        </Button>
      </div>

      {/* Loading State */}
      {launchesQuery.isLoading && (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      )}

      {/* Error State */}
      {launchesQuery.error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-800 dark:text-red-400 px-4 py-3 rounded">
          Erro ao carregar lançamentos: {launchesQuery.error.message}
        </div>
      )}

      {/* Table */}
      {launchesQuery.data && launchesQuery.data.data.length > 0 && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Categoria
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Descrição
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Vencimento
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {launchesQuery.data.data.map((launch: Launch) => (
                    <tr
                      key={launch.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(launch.type)}
                          <span className="text-sm font-medium">
                            {launch.type === "income" ? "Receita" : "Despesa"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {launch.category || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {launch.description || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        R$ {(parseFloat(launch.amount || "0") / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {launch.dueDate ? new Date(launch.dueDate).toLocaleDateString("pt-BR") : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(launch.status)}`}>
                          {launch.status === "pending"
                            ? "Pendente"
                            : launch.status === "paid"
                              ? "Pago"
                              : launch.status === "overdue"
                                ? "Vencido"
                                : "Cancelado"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </button>
                          <button
                            onClick={() => handleDelete(launch.id)}
                            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {launchesQuery.data.pagination && (
            <Pagination
              page={page}
              pages={launchesQuery.data.pagination.pages}
              total={launchesQuery.data.pagination.total}
              limit={10}
              onPageChange={setPage}
              onLimitChange={() => {}}
            />
          )}
        </>
      )}

      {/* Empty State */}
      {launchesQuery.data && launchesQuery.data.data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Nenhum lançamento encontrado
          </p>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Criar Primeiro Lançamento
          </Button>
        </div>
      )}
    </div>
  );
}
