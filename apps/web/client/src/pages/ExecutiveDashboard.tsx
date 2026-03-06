import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Loader, TrendingUp, Users, Calendar, Briefcase, DollarSign, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface KPIs {
  customers: {
    total: number;
    active: number;
    inactive: number;
  };
  appointments: {
    total: number;
    completed: number;
    pending: number;
    completionRate: number;
  };
  serviceOrders: {
    total: number;
    completed: number;
    inProgress: number;
    completionRate: number;
  };
  revenue: {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    collectionRate: number;
  };
  governance: {
    criticalRisks: number;
    highRisks: number;
    averageRiskScore: number;
    totalAssessments: number;
  };
}

interface RevenueTrend {
  month: string;
  revenue: number;
}

interface Distribution {
  name: string;
  value: number;
  fill: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  target: number;
  status: "success" | "warning" | "danger";
}

export default function ExecutiveDashboard() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend[]>([]);
  const [appointmentDist, setAppointmentDist] = useState<Distribution[]>([]);
  const [chargeDist, setChargeDist] = useState<Distribution[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);

  // Queries
  const kpisQuery = trpc.dashboard.dashboard.kpis.useQuery(undefined);
  const revenueTrendQuery = trpc.dashboard.dashboard.revenueTrend.useQuery(undefined);
  const appointmentDistQuery = trpc.dashboard.dashboard.appointmentDistribution.useQuery(undefined);
  const chargeDistQuery = trpc.dashboard.dashboard.chargeDistribution.useQuery(undefined);
  const performanceQuery = trpc.dashboard.dashboard.performanceMetrics.useQuery(undefined);

  useEffect(() => {
    if (kpisQuery.data) setKpis(kpisQuery.data as unknown as KPIs);
  }, [kpisQuery.data]);

  useEffect(() => {
    if (revenueTrendQuery.data) setRevenueTrend(revenueTrendQuery.data as unknown as RevenueTrend[]);
  }, [revenueTrendQuery.data]);

  useEffect(() => {
    if (appointmentDistQuery.data) setAppointmentDist(appointmentDistQuery.data as unknown as Distribution[]);
  }, [appointmentDistQuery.data]);

  useEffect(() => {
    if (chargeDistQuery.data) setChargeDist(chargeDistQuery.data as unknown as Distribution[]);
  }, [chargeDistQuery.data]);

  useEffect(() => {
    if (performanceQuery.data) setPerformanceMetrics(performanceQuery.data as unknown as PerformanceMetric[]);
  }, [performanceQuery.data]);

  const isLoading = kpisQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard Executivo
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Resumo geral de KPIs e métricas de negócio
        </p>
      </div>

      {/* Main KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Customers */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Clientes</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {kpis.customers.total}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {kpis.customers.active} ativos
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
          </div>

          {/* Appointments */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Agendamentos</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {kpis.appointments.total}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {kpis.appointments.completionRate}% concluídos
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500 opacity-20" />
            </div>
          </div>

          {/* Service Orders */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Ordens de Serviço</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {kpis.serviceOrders.total}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {kpis.serviceOrders.completionRate}% concluídas
                </p>
              </div>
              <Briefcase className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </div>

          {/* Revenue */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Receita Total</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  R$ {(kpis.revenue.total / 100).toFixed(0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {kpis.revenue.collectionRate}% recebida
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
          </div>

          {/* Risk Score */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-red-500">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Score de Risco</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {kpis.governance.averageRiskScore}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {kpis.governance.criticalRisks} críticos
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500 opacity-20" />
            </div>
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        {revenueTrend.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Tendência de Receita (12 meses)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `R$ ${value}`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#F97316"
                  strokeWidth={2}
                  name="Receita (R$)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Appointment Distribution */}
        {appointmentDist.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Distribuição de Agendamentos
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={appointmentDist}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {appointmentDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charge Distribution */}
        {chargeDist.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Distribuição de Cobranças
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chargeDist}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chargeDist.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Performance Metrics */}
        {performanceMetrics.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Métricas de Performance
            </h3>
            <div className="space-y-4">
              {performanceMetrics.map((metric, index) => (
                <div key={index}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {metric.name}
                    </p>
                    <span
                      className={`text-sm font-bold ${
                        metric.status === "success"
                          ? "text-green-600 dark:text-green-400"
                          : metric.status === "warning"
                          ? "text-yellow-600 dark:text-yellow-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {metric.value}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        metric.status === "success"
                          ? "bg-green-500"
                          : metric.status === "warning"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(metric.value, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Meta: {metric.target}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Revenue Breakdown */}
      {kpis && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Análise de Receita
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-700 dark:text-green-400 font-medium">Recebida</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-300 mt-2">
                R$ {(kpis.revenue.paid / 100).toFixed(2)}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {Math.round((kpis.revenue.paid / kpis.revenue.total) * 100)}% do total
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">Pendente</p>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-300 mt-2">
                R$ {(kpis.revenue.pending / 100).toFixed(2)}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                {Math.round((kpis.revenue.pending / kpis.revenue.total) * 100)}% do total
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">Vencida</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-300 mt-2">
                R$ {(kpis.revenue.overdue / 100).toFixed(2)}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {Math.round((kpis.revenue.overdue / kpis.revenue.total) * 100)}% do total
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">Total</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-300 mt-2">
                R$ {(kpis.revenue.total / 100).toFixed(2)}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Taxa de cobrança: {kpis.revenue.collectionRate}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
