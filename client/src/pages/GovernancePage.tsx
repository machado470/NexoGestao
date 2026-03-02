import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/DataTable";
import { Plus, Loader, AlertTriangle, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line } from "recharts";

interface GovernanceRecord {
  id: number;
  customerId: number | null;
  appointmentId: number | null;
  serviceOrderId: number | null;
  chargeId: number | null;
  riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  complianceStatus: "compliant" | "warning" | "non_compliant";
  issues: string | null;
  recommendations: string | null;
  notes: string | null;
  lastEvaluated: Date;
  evaluatedBy: string | null;
}

interface RiskSummary {
  total: number;
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  complianceDistribution: {
    compliant: number;
    warning: number;
    nonCompliant: number;
  };
  averageRiskScore: number;
}

interface RiskDistribution {
  name: string;
  value: number;
  fill: string;
}

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const COMPLIANCE_COLORS: Record<string, string> = {
  compliant: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  non_compliant: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function GovernancePage() {
  const [governance, setGovernance] = useState<GovernanceRecord[]>([]);
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [riskDistribution, setRiskDistribution] = useState<RiskDistribution[]>([]);
  const [complianceDistribution, setComplianceDistribution] = useState<RiskDistribution[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Queries
  const listGovernance = trpc.governance.governance.list.useQuery({ page, limit });
  const governanceSummary = trpc.governance.governance.riskSummary.useQuery({ page: 1, limit: 100 });
  const riskData = trpc.governance.governance.riskDistribution.useQuery({ page: 1, limit: 100 });
  const complianceData = trpc.governance.governance.complianceDistribution.useQuery({ page: 1, limit: 100 });

  useEffect(() => {
    if (listGovernance.data) {
      const response = listGovernance.data as any;
      if (response && response.data && response.pagination) {
        setGovernance(response.data);
        setPagination(response.pagination);
      }
    }
  }, [listGovernance.data]);

  useEffect(() => {
    if (governanceSummary.data) {
      setSummary(governanceSummary.data as RiskSummary);
    }
  }, [governanceSummary.data]);

  useEffect(() => {
    if (riskData.data) {
      setRiskDistribution(riskData.data as RiskDistribution[]);
    }
  }, [riskData.data]);

  useEffect(() => {
    if (complianceData.data) {
      setComplianceDistribution(complianceData.data as RiskDistribution[]);
    }
  }, [complianceData.data]);

  useEffect(() => {
    if (listGovernance.error) {
      toast.error("Erro ao carregar governança: " + listGovernance.error.message);
    }
  }, [listGovernance.error]);

  const columns = [
    {
      key: "riskScore" as const,
      label: "Score de Risco",
      sortable: true,
      render: (value: number) => (
        <div className="flex items-center gap-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-xs">
            <div
              className={`h-2 rounded-full ${
                value >= 80
                  ? "bg-red-500"
                  : value >= 60
                  ? "bg-orange-500"
                  : value >= 40
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{ width: `${value}%` }}
            />
          </div>
          <span className="font-semibold">{value}</span>
        </div>
      ),
    },
    {
      key: "riskLevel" as const,
      label: "Nível de Risco",
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${RISK_COLORS[value]}`}>
          {value === "critical"
            ? "Crítico"
            : value === "high"
            ? "Alto"
            : value === "medium"
            ? "Médio"
            : "Baixo"}
        </span>
      ),
    },
    {
      key: "complianceStatus" as const,
      label: "Status de Conformidade",
      render: (value: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${COMPLIANCE_COLORS[value]}`}>
          {value === "compliant"
            ? "Conforme"
            : value === "warning"
            ? "Aviso"
            : "Não Conforme"}
        </span>
      ),
    },
    {
      key: "lastEvaluated" as const,
      label: "Última Avaliação",
      render: (value: Date) => new Date(value).toLocaleDateString("pt-BR"),
    },
  ];

  if (listGovernance.isLoading && governance.length === 0) {
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
            Governança
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Análise de risco e conformidade em tempo real
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Score Médio de Risco</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {summary.averageRiskScore}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-red-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Críticos</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {summary.riskDistribution.critical}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-orange-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Altos</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {summary.riskDistribution.high}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Conformes</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {summary.complianceDistribution.compliant}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        {riskDistribution.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Distribuição de Risco
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Compliance Distribution */}
        {complianceDistribution.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Distribuição de Conformidade
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={complianceDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {complianceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Registros de Governança
        </h3>
        <DataTable
          columns={columns}
          data={governance}
          loading={false}
          searchable={true}
          searchFields={["riskLevel", "complianceStatus"]}
          emptyMessage="Nenhum registro de governança. Comece a avaliar riscos."
        />
      </div>

      {/* Risk Alerts */}
      {governance.filter((g) => g.riskLevel === "critical" || g.riskLevel === "high").length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Alertas de Risco
          </h3>
          <div className="space-y-3">
            {governance
              .filter((g) => g.riskLevel === "critical" || g.riskLevel === "high")
              .slice(0, 5)
              .map((record) => (
                <div key={record.id} className="flex items-start gap-3 pb-3 border-b border-red-200 dark:border-red-800 last:border-0">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {record.riskLevel === "critical" ? "🔴 CRÍTICO" : "🟠 ALTO"} - Score: {record.riskScore}
                    </p>
                    {record.issues && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {JSON.parse(record.issues).join(", ")}
                      </p>
                    )}
                    {record.recommendations && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 font-medium">
                        Recomendação: {JSON.parse(record.recommendations).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
