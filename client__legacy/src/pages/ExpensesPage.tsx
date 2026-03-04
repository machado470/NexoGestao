import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit2, Loader, Filter, DollarSign, TrendingDown } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { CreateExpenseModal } from "@/components/CreateExpenseModal";
import { toast } from "sonner";

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<
    "pending" | "paid" | "overdue" | "canceled" | undefined
  >();
  const [filterCategory, setFilterCategory] = useState<string>();

  const expensesQuery = trpc.expenses.list.useQuery({
    page,
    limit: 20,
    status: filterStatus,
    category: filterCategory,
  });

  const summaryQuery = trpc.expenses.summary.useQuery({});
  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("Despesa deletada com sucesso!");
      void expensesQuery.refetch();
      void summaryQuery.refetch();
    },
    onError: (error) => {
      toast.error("Erro ao deletar despesa: " + error.message);
    },
  });

  const handleCreateSuccess = () => {
    void expensesQuery.refetch();
    void summaryQuery.refetch();
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

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendente",
      paid: "Paga",
      overdue: "Vencida",
      canceled: "Cancelada",
    };
    return labels[status] || status;
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja deletar esta despesa?")) {
      deleteMutation.mutate({ id });
    }
  };

  const categories = summaryQuery.data?.byCategory
    ? Object.keys(summaryQuery.data.byCategory)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <TrendingDown className="w-8 h-8 text-orange-500" />
          Despesas
        </h1>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Despesa
        </Button>
      </div>

      {/* Summary Cards */}
      {summaryQuery.data && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total de Despesas</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summaryQuery.data.total}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Pagas</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {summaryQuery.data.paid}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {summaryQuery.data.pending}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Vencidas</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {summaryQuery.data.overdue}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Valor Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              R$ {(summaryQuery.data.totalAmount / 100).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Summary by Category */}
      {summaryQuery.data?.byCategory && Object.keys(summaryQuery.data.byCategory).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Despesas por Categoria
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(summaryQuery.data.byCategory).map(([category, amount]) => (
              <div key={category} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{category}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  R$ {((amount as number) / 100).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Filtros:
          </span>
        </div>

        <select
          value={filterStatus || ""}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "") setFilterStatus(undefined);
            else setFilterStatus(val as "pending" | "paid" | "overdue" | "canceled");
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="paid">Paga</option>
          <option value="overdue">Vencida</option>
          <option value="canceled">Cancelada</option>
        </select>

        {categories.length > 0 && (
          <select
            value={filterCategory || ""}
            onChange={(e) => setFilterCategory(e.target.value || undefined)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="">Todas as categorias</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}

        <Button
          variant="outline"
          onClick={() => {
            setFilterStatus(undefined);
            setFilterCategory(undefined);
          }}
          className="text-sm"
        >
          Limpar Filtros
        </Button>
      </div>

      {/* Modals */}
      <CreateExpenseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Loading State */}
      {expensesQuery.isLoading && (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      )}

      {/* Error State */}
      {expensesQuery.error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-800 dark:text-red-400 px-4 py-3 rounded">
          Erro ao carregar despesas: {expensesQuery.error.message}
        </div>
      )}

      {/* Table */}
      {expensesQuery.data && expensesQuery.data.data.length > 0 && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Descrição
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Categoria
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Vencimento
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Pagamento
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
                  {expensesQuery.data.data.map((expense: any) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {expense.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {expense.category}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        R$ {(parseFloat(expense.amount) / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {new Date(expense.dueDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {expense.paidDate
                          ? new Date(expense.paidDate).toLocaleDateString("pt-BR")
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                          {getStatusLabel(expense.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
                            <Edit2 className="w-4 h-4 text-green-500" />
                          </button>
                          <button
                            onClick={() => handleDelete(expense.id)}
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
          {expensesQuery.data.pagination && (
            <Pagination
              page={page}
              pages={expensesQuery.data.pagination.pages}
              total={expensesQuery.data.pagination.total}
              limit={10}
              onPageChange={setPage}
              onLimitChange={() => {}}
            />
          )}
        </>
      )}

      {/* Empty State */}
      {expensesQuery.data && expensesQuery.data.data.length === 0 && (
        <div className="text-center py-12">
          <DollarSign className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Nenhuma despesa registrada
          </p>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Registrar Primeira Despesa
          </Button>
        </div>
      )}
    </div>
  );
}
