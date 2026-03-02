import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";

export default function GovernancePage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  // Queries
  const governanceList = trpc.governance.governance.list.useQuery({ page, limit });
  const riskSummary = trpc.governance.governance.riskSummary.useQuery({ page: 1, limit: 100 });
  const riskDistribution = trpc.governance.governance.riskDistribution.useQuery({ page: 1, limit: 100 });
  const complianceDistribution = trpc.governance.governance.complianceDistribution.useQuery({ page: 1, limit: 100 });

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case "compliant":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "warning":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "non_compliant":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "critical":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "high":
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case "medium":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "low":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return null;
    }
  };

  if (governanceList.isLoading || riskSummary.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Governança</h1>
        <p className="text-gray-600 dark:text-gray-400">Análise de riscos e conformidade</p>
      </div>

      {/* Summary Cards */}
      {riskSummary.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Avaliações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{riskSummary.data.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Risco Médio</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{riskSummary.data.averageRiskScore}</div>
              <p className="text-xs text-gray-500">em 100</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Críticos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{riskSummary.data.riskDistribution.critical}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Conforme</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{riskSummary.data.complianceDistribution.compliant}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Risk Distribution */}
      {riskDistribution.data && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Riscos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {riskDistribution.data.map((item: any) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Governance List */}
      <Card>
        <CardHeader>
          <CardTitle>Avaliações de Governança</CardTitle>
          <CardDescription>
            Página {page} de {governanceList.data?.pagination.pages || 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {governanceList.data?.data && governanceList.data.data.length > 0 ? (
            <div className="space-y-4">
              {governanceList.data.data.map((governance: any) => (
                <div
                  key={governance.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getRiskIcon(governance.riskLevel)}
                        <h3 className="font-semibold">
                          Avaliação #{governance.id}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge className={getRiskColor(governance.riskLevel)}>
                          Risco: {governance.riskLevel}
                        </Badge>
                        <Badge className={getComplianceColor(governance.complianceStatus)}>
                          {governance.complianceStatus === "compliant"
                            ? "Conforme"
                            : governance.complianceStatus === "warning"
                            ? "Aviso"
                            : "Não Conforme"}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <p>Pontuação de Risco: {governance.riskScore}/100</p>
                        {governance.evaluatedBy && (
                          <p>Avaliado por: {governance.evaluatedBy}</p>
                        )}
                      </div>
                      {governance.issues && governance.issues.length > 0 && (
                        <div className="mt-2 text-sm">
                          <p className="font-medium text-red-600">Problemas:</p>
                          <ul className="list-disc list-inside">
                            {governance.issues.map((issue: string, idx: number) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {governance.recommendations && governance.recommendations.length > 0 && (
                        <div className="mt-2 text-sm">
                          <p className="font-medium text-blue-600">Recomendações:</p>
                          <ul className="list-disc list-inside">
                            {governance.recommendations.map((rec: string, idx: number) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <div className="flex justify-between items-center mt-6">
                <Button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  variant="outline"
                >
                  Anterior
                </Button>
                <span className="text-sm text-gray-600">
                  Página {page} de {governanceList.data.pagination.pages}
                </span>
                <Button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= governanceList.data.pagination.pages}
                  variant="outline"
                >
                  Próxima
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Nenhuma avaliação de governança encontrada
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
