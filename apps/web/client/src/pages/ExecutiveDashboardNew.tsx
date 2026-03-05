import { useState, useEffect } from "react";
import {
  Users,
  Briefcase,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Clock,
  CheckCircle,
  Loader,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type {
  DashboardMetrics,
  RevenueData,
  CustomerGrowthData,
  ServiceOrdersStatus,
  ChargesStatus,
} from "@/lib/api";

interface MetricCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}

export default function ExecutiveDashboardNew() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [growthData, setGrowthData] = useState<CustomerGrowthData[]>([]);
  const [serviceOrdersStatus, setServiceOrdersStatus] =
    useState<ServiceOrdersStatus | null>(null);
  const [chargesStatus, setChargesStatus] = useState<ChargesStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [metrics, revenue, growth, orders, charges] = await Promise.all([
        api.getDashboardMetrics(),
        api.getDashboardRevenue(),
        api.getDashboardGrowth(),
        api.getDashboardServiceOrdersStatus(),
        api.getDashboardChargesStatus(),
      ]);

      setMetrics(metrics);
      setRevenueData(revenue);
      setGrowthData(growth);
      setServiceOrdersStatus(orders);
      setChargesStatus(charges);
    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
      toast.error("Erro ao carregar dados do dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const metricCards: MetricCard[] = [
    {
      title: "Total de Clientes",
      value: metrics?.totalCustomers ?? 0,
      icon: <Users className="w-6 h-6" />,
      color: "bg-blue-500",
    },
    {
      title: "O.S. Abertas",
      value: metrics?.openServiceOrders ?? 0,
      icon: <Briefcase className="w-6 h-6" />,
      color: "bg-purple-500",
    },
    {
      title: "O.S. Atrasadas",
      value: metrics?.overdueServiceOrders ?? 0,
      icon: <AlertTriangle className="w-6 h-6" />,
      color: "bg-red-500",
    },
    {
      title: "Faturamento Semanal",
      value: `R$ ${((metrics?.weeklyRevenueInCents ?? 0) / 100).toFixed(2)}`,
      icon: <TrendingUp className="w-6 h-6" />,
      color: "bg-green-500",
    },
    {
      title: "Pagamentos Pendentes",
      value: `R$ ${((metrics?.pendingPaymentsInCents ?? 0) / 100).toFixed(2)}`,
      icon: <DollarSign className="w-6 h-6" />,
      color: "bg-yellow-500",
    },
    {
      title: "Tickets de Risco",
      value: metrics?.riskTickets ?? 0,
      icon: <AlertTriangle className="w-6 h-6" />,
      color: "bg-orange-500",
    },
  ];

  // Dados para o gráfico de pizza de status de ordens
  const orderStatusData = serviceOrdersStatus
    ? [
        { name: "Aberto", value: serviceOrdersStatus.open },
        { name: "Atribuído", value: serviceOrdersStatus.assigned },
        { name: "Em Progresso", value: serviceOrdersStatus.inProgress },
        { name: "Concluído", value: serviceOrdersStatus.completed },
        { name: "Cancelado", value: serviceOrdersStatus.cancelled },
        { name: "Em Espera", value: serviceOrdersStatus.onHold },
      ]
    : [];

  // Dados para o gráfico de pizza de status de cobranças
  const chargeStatusData = chargesStatus
    ? [
        { name: "Pendente", value: chargesStatus.pending },
        { name: "Pago", value: chargesStatus.paid },
        { name: "Atrasado", value: chargesStatus.overdue },
        { name: "Cancelado", value: chargesStatus.cancelled },
        { name: "Reembolsado", value: chargesStatus.refunded },
        { name: "Parcial", value: chargesStatus.partial },
      ]
    : [];

  const COLORS = [
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#ef4444",
    "#10b981",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Executive Dashboard
          </h1>
          <p className="text-slate-400">
            Visão geral das métricas operacionais do sistema
          </p>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {metricCards.map((card, index) => (
            <div
              key={index}
              className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-300 text-sm font-medium">
                  {card.title}
                </h3>
                <div className={`${card.color} p-3 rounded-lg text-white`}>
                  {card.icon}
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold text-white">
                    {card.value}
                  </p>
                  {card.trend && (
                    <p className="text-green-400 text-sm mt-1">{card.trend}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Revenue Cards */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-300 text-sm font-medium">
                Faturamento Total
              </h3>
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              R$ {((metrics?.totalRevenueInCents ?? 0) / 100).toFixed(2)}
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-300 text-sm font-medium">
                Faturamento Pago
              </h3>
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-green-400">
              R$ {((metrics?.paidRevenueInCents ?? 0) / 100).toFixed(2)}
            </p>
          </div>

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-300 text-sm font-medium">
                Faturamento Pendente
              </h3>
              <Clock className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-3xl font-bold text-yellow-400">
              R$ {((metrics?.pendingRevenueInCents ?? 0) / 100).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Trend Chart */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">
              Faturamento - Últimos 12 Meses
            </h3>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-center py-8">
                Sem dados disponíveis
              </p>
            )}
          </div>

          {/* Customer Growth Chart */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">
              Crescimento de Clientes - Últimos 12 Meses
            </h3>
            {growthData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <Legend />
                  <Bar dataKey="newCustomers" fill="#8b5cf6" name="Novos" />
                  <Bar
                    dataKey="totalCustomers"
                    fill="#3b82f6"
                    name="Total Acumulado"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-center py-8">
                Sem dados disponíveis
              </p>
            )}
          </div>
        </div>

        {/* Status Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Service Orders Status */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">
              Status das Ordens de Serviço
            </h3>
            {orderStatusData.length > 0 && orderStatusData.some(d => (d.value ?? 0) > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {orderStatusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-center py-8">
                Sem dados disponíveis
              </p>
            )}
          </div>

          {/* Charges Status */}
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h3 className="text-white font-semibold mb-4">
              Status das Cobranças
            </h3>
            {chargeStatusData.length > 0 && chargeStatusData.some(d => (d.value ?? 0) > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={chargeStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chargeStatusData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-center py-8">
                Sem dados disponíveis
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
