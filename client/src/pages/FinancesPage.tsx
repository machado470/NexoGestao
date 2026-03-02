import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Plus, Loader, TrendingUp, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import { EditChargeModal } from "@/components/EditChargeModal";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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
  amount: number;
}

export default function FinancesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChargeId, setSelectedChargeId] = useState<number | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Queries
  const listCharges = trpc.finance.charges.list.useQuery({ page, limit });
  const chargeStats = trpc.finance.charges.stats.useQuery({ page: 1, limit: 100 });
  const revenueData = trpc.finance.charges.revenueByMonth.useQuery({ page: 1, limit: 100 });

  useEffect(() => {
    if (listCharges.data) {
      const response = listCharges.data as any;
      if (response && response.data && response.pagination) {
        setCharges(response.data);
        setPagination(response.pagination);
      }
    }
  }, [listCharges.data]);

  useEffect(() => {
    if (chargeStats.data) {
      setStats(chargeStats.data as FinanceStats);
    }
  }, [chargeStats.data]);

  useEffect(() => {
    if (revenueData.data) {
      setMonthlyRevenue(revenueData.data as MonthlyRevenue[]);
    }
  }, [revenueData.data]);

  useEffect(() => {
    if (listCharges.error) {
      toast.error("Erro ao carregar cobranças: " + listCharges.error.message);
    }
  }, [listCharges.error]);

  const handleCreateSuccess = () => {
    void listCharges.refetch();
    void chargeStats.refetch();
    void revenueData.refetch();
  };

  const deleteCharge = trpc.finance.charges.delete.useMutation({
    onSuccess: () => {
      toast.success("Cobrança deletada com sucesso!");
      void listCharges.refetch();
      void chargeStats.refetch();
      setShowDeleteModal(false);
      setSelectedChargeId(null);
    },
    onError: (error) => {
      toast.error("Erro ao deletar cobrança: " + error.message);
    },
  });

  const handleEdit = (charge: Charge) => {
    setSelectedChargeId(charge.id);
    setShowEditModal(true);
  };

  const handleDelete = (charge: Charge) => {
    setSelectedChargeId(charge.id);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (selectedChargeId) {
      deleteCharge.mutate({ id: selectedChargeId });
    }
  };

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

  const columns = [
    {
      key: "description" as const,
      label: "Descrição",
      sortable: true,
    },
    {
      key: "amount" as const,
      label: "Valor",
      render: (value: number) => formatCurrency(value),
    },
    {
      key: "dueDate" as const,
      label: "Vencimento",
      render: (value: Date) => formatDate(value),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          {value}
        </span>
      ),
    },
    {
      key: "createdAt" as const,
      label: "Criado em",
      render: (value: Date) => formatDate(value),
    },
  ];

  const pieData = stats
    ? [
        { name: "Pendente", value: stats.totalPendingAmount / 100, fill: "#FCD34D" },
        { name: "Pago", value: stats.totalPaidAmount / 100, fill: "#86EFAC" },
        { name: "Vencido", value: stats.totalOverdueAmount / 100, fill: "#FCA5A5" },
      ]
    : [];

  if (listCharges.isLoading && charges.length === 0) {
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
            Finanças
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Gerencie suas cobranças e receitas
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Cobrança
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total de Cobranças</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.totalCharges}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Pendentes</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.totalPending}
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  {formatCurrency(stats.totalPendingAmount)}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-red-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Vencidas</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.totalOverdue}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                  {formatCurrency(stats.totalOverdueAmount)}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Recebidas</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {stats.totalPaid}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  {formatCurrency(stats.totalPaidAmount)}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Month */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Receita por Mês
          </h3>
          {monthlyRevenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(value)
                  }
                />
                <Bar dataKey="amount" fill="#F97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-gray-500">
              Sem dados de receita
            </div>
          )}
        </div>

        {/* Status Distribution */}
        {stats && pieData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Distribuição de Cobranças
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) =>
                    `${name}: ${new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(value)}`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(value)
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Todas as Cobranças
        </h3>
        <DataTable
          columns={columns}
          data={charges}
          loading={false}
          searchable={true}
          searchFields={["description"]}
          emptyMessage="Nenhuma cobrança cadastrada. Crie a primeira clicando em 'Nova Cobrança'."
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      {/* Modals */}
      <CreateChargeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
      <EditChargeModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleCreateSuccess}
        chargeId={selectedChargeId}
      />
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        title="Deletar Cobrança"
        message="Tem certeza que deseja deletar esta cobrança? Esta ação não pode ser desfeita."
        itemName={charges.find((c) => c.id === selectedChargeId)?.description}
        isLoading={deleteCharge.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
