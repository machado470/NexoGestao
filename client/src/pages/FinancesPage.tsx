import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Plus, Loader, TrendingUp, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import { EditChargeModal } from "@/components/EditChargeModal";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Charge {
  id: number;
  customerId: number;
  description: string;
  amount: number;
  dueDate: Date;
  paidDate: Date | null;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELED";
  notes: string | null;
  createdAt: Date;
}

interface FinanceStats {
  totalCharges: number;
  totalPending: number;
  totalPaid: number;
  totalOverdue: number;
  totalPendingAmount: number;
  totalPaidAmount: number;
  totalOverdueAmount: number;
  totalAmount: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export default function FinancesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChargeId, setSelectedChargeId] = useState<number | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Queries
  const listChargesQuery = trpc.finance.charges.list.useQuery({ page, limit });
  const statsQuery = trpc.finance.stats.useQuery({ page: 1, limit: 100 });
  const revenueQuery = trpc.finance.revenueByMonth.useQuery({ page: 1, limit: 100 });

  // Update charges when data changes
  useEffect(() => {
    if (listChargesQuery.data) {
      const response = listChargesQuery.data as any;
      if (response && response.data && response.pagination) {
        setCharges(response.data);
        setPagination(response.pagination);
      }
    }
  }, [listChargesQuery.data]);

  // Show error toast
  useEffect(() => {
    if (listChargesQuery.error) {
      toast.error("Erro ao carregar cobranças: " + listChargesQuery.error.message);
    }
  }, [listChargesQuery.error]);

  const handleRefresh = () => {
    void listChargesQuery.refetch();
    void statsQuery.refetch();
    void revenueQuery.refetch();
  };

  const deleteChargeMutation = trpc.finance.charges.delete.useMutation({
    onSuccess: () => {
      toast.success("Cobrança deletada com sucesso!");
      handleRefresh();
      setShowDeleteModal(false);
    },
    onError: (error) => {
      toast.error("Erro ao deletar cobrança: " + error.message);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      OVERDUE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      CANCELED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const stats = statsQuery.data;
  const monthlyData = revenueQuery.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Financeiro</h1>
          <p className="text-gray-600 dark:text-gray-400">Gerencie cobranças, despesas e notas fiscais</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Cobrança
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Charges */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total de Cobranças</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.totalCharges || 0}
              </h3>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500 opacity-20" />
          </div>
        </div>

        {/* Pending Amount */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pendente</p>
              <h3 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {formatCurrency(stats?.totalPendingAmount || 0)}
              </h3>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500 opacity-20" />
          </div>
        </div>

        {/* Paid Amount */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Recebido</p>
              <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrency(stats?.totalPaidAmount || 0)}
              </h3>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500 opacity-20" />
          </div>
        </div>

        {/* Overdue Amount */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Vencido</p>
              <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrency(stats?.totalOverdueAmount || 0)}
              </h3>
            </div>
            <TrendingUp className="w-8 h-8 text-red-500 opacity-20" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="charges" className="w-full">
        <TabsList>
          <TabsTrigger value="charges">Cobranças</TabsTrigger>
          <TabsTrigger value="revenue">Receita por Mês</TabsTrigger>
        </TabsList>

        {/* Charges Tab */}
        <TabsContent value="charges" className="space-y-4">
          {listChargesQuery.isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : charges.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                        Descrição
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                        Valor
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                        Vencimento
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((charge) => (
                      <tr
                        key={charge.id}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {charge.description}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400 font-semibold">
                          {formatCurrency(charge.amount)}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          {formatDate(charge.dueDate)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(charge.status)}`}>
                            {charge.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedChargeId(charge.id);
                              setShowEditModal(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedChargeId(charge.id);
                              setShowDeleteModal(true);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Deletar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex justify-between items-center p-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Página {pagination.page} de {pagination.pages} ({pagination.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage(Math.max(1, page - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => setPage(page + 1)}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3 opacity-50" />
              <p className="text-gray-600 dark:text-gray-400">
                Nenhuma cobrança registrada. Crie a primeira!
              </p>
            </div>
          )}
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          {revenueQuery.isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : monthlyData.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Receita por Mês
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#10b981" name="Receita" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3 opacity-50" />
              <p className="text-gray-600 dark:text-gray-400">
                Nenhum dado de receita disponível
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateChargeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleRefresh}
      />

      {selectedChargeId && (
        <EditChargeModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedChargeId(null);
          }}
          chargeId={selectedChargeId}
          onSuccess={handleRefresh}
        />
      )}

      {selectedChargeId && (
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          onCancel={() => {
            setShowDeleteModal(false);
            setSelectedChargeId(null);
          }}
          onConfirm={() => {
            deleteChargeMutation.mutate({ id: selectedChargeId });
          }}
          title="Deletar Cobrança"
          message="Tem certeza que deseja deletar esta cobrança?"
          isLoading={deleteChargeMutation.isPending}
        />
      )}
    </div>
  );
}
