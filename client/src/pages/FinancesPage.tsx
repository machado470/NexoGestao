import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Plus, Loader, TrendingUp, DollarSign, AlertCircle, CheckCircle, Receipt, FileText, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { CreateChargeModal } from "@/components/CreateChargeModal";
import { EditChargeModal } from "@/components/EditChargeModal";
import { CreateExpenseModal } from "@/components/CreateExpenseModal";
import { CreateInvoiceModal } from "@/components/CreateInvoiceModal";
import { EditExpenseModal } from "@/components/EditExpenseModal";
import { EditInvoiceModal } from "@/components/EditInvoiceModal";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

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

interface Expense {
  id: number;
  description: string;
  amount: number;
  date: Date;
  category: string;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: Date;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  issueDate: Date;
  amount: number;
  status: "issued" | "cancelled" | "pending";
  pdfUrl: string | null;
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
  totalExpensesAmount: number;
  netProfit: number;
  totalAmount: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export default function FinancesPage() {
  const [activeTab, setActiveTab] = useState("revenue");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  
  // Queries
  const listCharges = trpc.finance.charges.list.useQuery(undefined);
  const listExpenses = trpc.finance.expenses.list.useQuery(undefined);
  const listInvoices = trpc.finance.invoices.list.useQuery(undefined);
  const financeStats = trpc.finance.stats.useQuery(undefined);
  const monthlyData = trpc.finance.revenueByMonth.useQuery(undefined);

  const handleRefresh = () => {
    void listCharges.refetch();
    void listExpenses.refetch();
    void listInvoices.refetch();
    void financeStats.refetch();
    void monthlyData.refetch();
  };

  const deleteCharge = trpc.finance.charges.delete.useMutation({
    onSuccess: () => {
      toast.success("Cobrança deletada com sucesso!");
      handleRefresh();
      setShowDeleteModal(false);
    },
  });

  const deleteExpense = trpc.finance.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("Despesa deletada com sucesso!");
      handleRefresh();
      setShowDeleteModal(false);
    },
  });

  const deleteInvoice = trpc.finance.invoices.delete.useMutation({
    onSuccess: () => {
      toast.success("Nota fiscal deletada com sucesso!");
      handleRefresh();
      setShowDeleteModal(false);
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
      PENDING: "bg-yellow-100 text-yellow-800",
      PAID: "bg-green-100 text-green-800",
      OVERDUE: "bg-red-100 text-red-800",
      issued: "bg-blue-100 text-blue-800",
      cancelled: "bg-gray-100 text-gray-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const revenueColumns = [
    { key: "description", label: "Descrição", sortable: true },
    { key: "amount", label: "Valor", render: (v: number) => formatCurrency(v) },
    { key: "dueDate", label: "Vencimento", render: (v: Date) => formatDate(v) },
    { key: "status", label: "Status", render: (v: string) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(v)}`}>{v}</span>
    )},
  ];

  const expenseColumns = [
    { key: "description", label: "Descrição", sortable: true },
    { key: "amount", label: "Valor", render: (v: number) => formatCurrency(v) },
    { key: "category", label: "Categoria" },
    { key: "date", label: "Data", render: (v: Date) => formatDate(v) },
  ];

  const invoiceColumns = [
    { key: "invoiceNumber", label: "Nº Nota", sortable: true },
    { key: "amount", label: "Valor", render: (v: number) => formatCurrency(v) },
    { key: "issueDate", label: "Emissão", render: (v: Date) => formatDate(v) },
    { key: "status", label: "Status", render: (v: string) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(v)}`}>{v}</span>
    )},
  ];

  const stats = financeStats.data;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Finanças</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestão completa de receitas, despesas e notas fiscais</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          {activeTab === "revenue" ? "Nova Cobrança" : activeTab === "expenses" ? "Nova Despesa" : "Nova Nota Fiscal"}
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Receita Total (Paga)</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(stats.totalPaidAmount)}</p>
              </div>
              <ArrowUpCircle className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-red-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Despesas Totais</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(stats.totalExpensesAmount)}</p>
              </div>
              <ArrowDownCircle className="w-8 h-8 text-red-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Lucro Líquido</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(stats.netProfit)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">A Receber (Pendente)</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">{formatCurrency(stats.totalPendingAmount)}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500 opacity-20" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Fluxo de Caixa</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyData.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => formatCurrency(v * 100)} />
              <Legend />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Receita" />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="Despesa" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Comparativo Mensal</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => formatCurrency(v * 100)} />
              <Legend />
              <Bar dataKey="revenue" fill="#10b981" name="Receita" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#ef4444" name="Despesa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Tabs defaultValue="revenue" onValueChange={setActiveTab} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <TabsList className="mb-6">
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Receitas
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <ArrowDownCircle className="w-4 h-4" /> Despesas
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="w-4 h-4" /> Notas Fiscais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <DataTable columns={revenueColumns} data={listCharges.data || []} loading={listCharges.isLoading} onEdit={(item) => { setSelectedId(item.id); setShowEditModal(true); }} onDelete={(item) => { setSelectedId(item.id); setShowDeleteModal(true); }} />
        </TabsContent>
        <TabsContent value="expenses">
          <DataTable columns={expenseColumns} data={listExpenses.data || []} loading={listExpenses.isLoading} onEdit={(item) => { setSelectedId(item.id); setShowEditModal(true); }} onDelete={(item) => { setSelectedId(item.id); setShowDeleteModal(true); }} />
        </TabsContent>
        <TabsContent value="invoices">
          <DataTable columns={invoiceColumns} data={listInvoices.data || []} loading={listInvoices.isLoading} onEdit={(item) => { setSelectedId(item.id); setShowEditModal(true); }} onDelete={(item) => { setSelectedId(item.id); setShowDeleteModal(true); }} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateChargeModal
        isOpen={showCreateModal && activeTab === "revenue"}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleRefresh}
      />
      <CreateExpenseModal
        isOpen={showCreateModal && activeTab === "expenses"}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleRefresh}
      />
      <CreateInvoiceModal
        isOpen={showCreateModal && activeTab === "invoices"}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleRefresh}
      />
      <EditChargeModal
        isOpen={showEditModal && activeTab === "revenue"}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleRefresh}
        chargeId={selectedId}
      />
      <EditExpenseModal
        isOpen={showEditModal && activeTab === "expenses"}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleRefresh}
        expenseId={selectedId}
      />
      <EditInvoiceModal
        isOpen={showEditModal && activeTab === "invoices"}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleRefresh}
        invoiceId={selectedId}
      />
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        title={`Deletar ${activeTab === "revenue" ? "Cobrança" : activeTab === "expenses" ? "Despesa" : "Nota Fiscal"}`}
        message="Tem certeza que deseja deletar este item? Esta ação não pode ser desfeita."
        isLoading={deleteCharge.isPending || deleteExpense.isPending || deleteInvoice.isPending}
        onConfirm={() => {
          if (selectedId) {
            if (activeTab === "revenue") deleteCharge.mutate({ id: selectedId });
            else if (activeTab === "expenses") deleteExpense.mutate({ id: selectedId });
            else if (activeTab === "invoices") deleteInvoice.mutate({ id: selectedId });
          }
        }}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
