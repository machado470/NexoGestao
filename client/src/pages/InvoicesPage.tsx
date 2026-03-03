import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit2, Download, Loader, Filter, FileText } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { CreateInvoiceModal } from "@/components/CreateInvoiceModal";
import { toast } from "sonner";

export default function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<
    "draft" | "issued" | "paid" | "canceled" | undefined
  >();

  const invoicesQuery = trpc.invoices.list.useQuery({
    page,
    limit: 20,
    status: filterStatus,
  });

  const summaryQuery = trpc.invoices.summary.useQuery(undefined);
  const customersQuery = trpc.data.customers.list.useQuery({ page: 1, limit: 1000 });
  
  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: () => {
      toast.success("Nota fiscal deletada com sucesso!");
      invoicesQuery.refetch();
    },
    onError: (error) => {
      toast.error("Erro ao deletar nota fiscal: " + error.message);
    },
  });

  const handleCreateSuccess = () => {
    void invoicesQuery.refetch();
    void summaryQuery.refetch();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
      issued: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      canceled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Rascunho",
      issued: "Emitida",
      paid: "Paga",
      canceled: "Cancelada",
    };
    return labels[status] || status;
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja deletar esta nota fiscal?")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <FileText className="w-8 h-8 text-orange-500" />
          Notas Fiscais
        </h1>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Nota Fiscal
        </Button>
      </div>

      {/* Summary Cards */}
      {summaryQuery.data && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total de NFs</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {summaryQuery.data.total}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Emitidas</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {summaryQuery.data.issued}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Pagas</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {summaryQuery.data.paid}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Valor Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              R$ {(summaryQuery.data.totalAmount / 100).toFixed(2)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Recebido</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              R$ {(summaryQuery.data.paidAmount / 100).toFixed(2)}
            </p>
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
          onChange={(e) =>
            setFilterStatus((e.target.value as "draft" | "issued" | "paid" | "canceled") || undefined)
          }
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">Todos os status</option>
          <option value="draft">Rascunho</option>
          <option value="issued">Emitida</option>
          <option value="paid">Paga</option>
          <option value="canceled">Cancelada</option>
        </select>

        <Button
          variant="outline"
          onClick={() => setFilterStatus(undefined)}
          className="text-sm"
        >
          Limpar Filtros
        </Button>
      </div>

      {/* Loading State */}
      {invoicesQuery.isLoading && (
        <div className="flex justify-center items-center h-64">
          <Loader className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      )}

      {/* Error State */}
      {invoicesQuery.error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 text-red-800 dark:text-red-400 px-4 py-3 rounded">
          Erro ao carregar notas fiscais: {invoicesQuery.error.message}
        </div>
      )}

      {/* Modals */}
      {customersQuery.data && (
        <CreateInvoiceModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
          customers={(customersQuery.data as any)?.data || []}
        />
      )}

      {/* Table */}
      {invoicesQuery.data && invoicesQuery.data.data.length > 0 && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      NF
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Data Emissão
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
                  {invoicesQuery.data.data.map((invoice: any) => (
                    <tr
                      key={invoice.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {invoice.invoiceNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {invoice.customerId}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        R$ {(parseFloat(invoice.amount) / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {new Date(invoice.issueDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                        {invoice.dueDate
                          ? new Date(invoice.dueDate).toLocaleDateString("pt-BR")
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {getStatusLabel(invoice.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
                            <Download className="w-4 h-4 text-blue-500" />
                          </button>
                          <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded">
                            <Edit2 className="w-4 h-4 text-green-500" />
                          </button>
                          <button
                            onClick={() => handleDelete(invoice.id)}
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
          {invoicesQuery.data.pagination && (
            <Pagination
              page={page}
              pages={invoicesQuery.data.pagination.pages}
              total={invoicesQuery.data.pagination.total}
              limit={10}
              onPageChange={setPage}
              onLimitChange={() => {}}
            />
          )}
        </>
      )}

      {/* Empty State */}
      {invoicesQuery.data && invoicesQuery.data.data.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Nenhuma nota fiscal encontrada
          </p>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Criar Primeira Nota Fiscal
          </Button>
        </div>
      )}
    </div>
  );
}
