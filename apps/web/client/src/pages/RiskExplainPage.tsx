import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  Search,
  Loader2,
} from "lucide-react";

type RiskFactor = {
  factor: string;
  weight: number;
  impact: "high" | "medium" | "low";
  reason: string;
};

type RiskExplanation = {
  personId: string;
  personName: string;
  riskScore: number;
  operationalRiskScore: number;
  operationalState: string;
  factors: RiskFactor[];
  summary: string;
  recommendations: string[];
  lastUpdated: string;
};

function getRiskColor(score: number): string {
  if (score >= 80) return "text-red-600 dark:text-red-400";
  if (score >= 60) return "text-orange-600 dark:text-orange-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 20) return "text-orange-600 dark:text-orange-300";
  return "text-green-600 dark:text-green-400";
}

function getRiskBgColor(score: number): string {
  if (score >= 80) return "bg-red-100 dark:bg-red-900/30";
  if (score >= 60) return "bg-orange-100 dark:bg-orange-900/30";
  if (score >= 40) return "bg-yellow-100 dark:bg-yellow-900/30";
  if (score >= 20) return "bg-orange-100 dark:bg-orange-500/20";
  return "bg-green-100 dark:bg-green-900/30";
}

function getImpactIcon(impact: string) {
  switch (impact) {
    case "high":
      return (
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
      );
    case "medium":
      return (
        <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      );
    case "low":
      return (
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
      );
    default:
      return null;
  }
}

export default function RiskExplainPage() {
  const { isAuthenticated, isInitializing, user } = useAuth();
  const canQuery =
    isAuthenticated &&
    !isInitializing &&
    (user?.role === "ADMIN" || user?.role === "MANAGER");

  const [personId, setPersonId] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const riskQuery = trpc.risk.explainPerson.useQuery(
    { personId },
    { enabled: canQuery && Boolean(personId), retry: false }
  );

  const explanation = useMemo<RiskExplanation | null>(() => {
    const payload = riskQuery.data;
    if (!payload) return null;
    return (payload as any)?.data ?? null;
  }, [riskQuery.data]);

  const handleSearch = () => {
    if (searchInput.trim()) {
      setPersonId(searchInput.trim());
    }
  };

  if (isInitializing) {
    return (
      <div className="nexo-surface flex min-h-[180px] items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Loader2 className="h-4 w-4 animate-spin text-red-500" />
        Carregando análise de risco...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="nexo-surface min-h-[180px] p-6 text-sm text-zinc-500 dark:text-zinc-400">
        Faça login para acessar a análise de risco.
      </div>
    );
  }

  if (user?.role !== "ADMIN" && user?.role !== "MANAGER") {
    return (
      <div className="nexo-surface min-h-[180px] p-6 text-sm text-zinc-500 dark:text-zinc-400">
        Acesso restrito a administradores e gerentes.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-200/80 bg-red-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700 dark:border-red-500/20 dark:bg-red-500/12 dark:text-red-300">
            <TrendingUp className="h-3.5 w-3.5" />
            Explainability de Risco
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Análise Detalhada de Risco
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Entenda por que cada pessoa tem um score de risco específico.
            Decomposição transparente de fatores e recomendações.
          </p>
        </div>

        {explanation && (
          <Button
            variant="outline"
            onClick={() => void riskQuery.refetch()}
            disabled={riskQuery.isFetching}
            className="h-10 rounded-xl border-slate-200/80 bg-white/80 px-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Buscar Pessoa</CardTitle>
          <CardDescription>
            Digite o ID ou nome da pessoa para analisar seu risco
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="ID ou nome da pessoa..."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleSearch();
                }}
                className="w-full rounded-lg border border-zinc-200 bg-white pl-10 pr-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder-zinc-400"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={!searchInput.trim()}
              className="gap-2"
            >
              Analisar
            </Button>
          </div>
        </CardContent>
      </Card>

      {riskQuery.isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-sm text-zinc-500">
              Analisando risco...
            </div>
          </CardContent>
        </Card>
      )}

      {riskQuery.isError && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="text-sm text-red-700 dark:text-red-300">
              Erro ao carregar análise de risco: {riskQuery.error?.message}
            </div>
          </CardContent>
        </Card>
      )}

      {explanation && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{explanation.personName}</CardTitle>
                  <CardDescription>
                    Análise atualizada em{" "}
                    {new Date(explanation.lastUpdated).toLocaleString("pt-BR")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div
                  className={`rounded-lg ${getRiskBgColor(explanation.riskScore)} p-4`}
                >
                  <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Score de Risco
                  </div>
                  <div
                    className={`mt-2 text-3xl font-bold ${getRiskColor(explanation.riskScore)}`}
                  >
                    {explanation.riskScore}
                  </div>
                </div>

                <div className="rounded-lg bg-orange-100 p-4 dark:bg-orange-500/20">
                  <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Risco Operacional
                  </div>
                  <div className="mt-2 text-3xl font-bold text-orange-600 dark:text-orange-300">
                    {explanation.operationalRiskScore}
                  </div>
                </div>

                <div className="rounded-lg bg-purple-100 p-4 dark:bg-purple-900/30">
                  <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Estado Operacional
                  </div>
                  <div className="mt-2 text-lg font-bold text-purple-600 dark:text-purple-400">
                    {explanation.operationalState}
                  </div>
                </div>

                <div className="rounded-lg bg-amber-100 p-4 dark:bg-amber-900/30">
                  <div className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Fatores Identificados
                  </div>
                  <div className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {explanation.factors.length}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <div className="font-semibold text-zinc-900 dark:text-white">
                  Resumo
                </div>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {explanation.summary}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-amber-500" />
                Fatores de Risco
              </CardTitle>
              <CardDescription>
                Decomposição dos fatores que compõem o score de risco
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {explanation.factors.map((factor, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700"
                  >
                    <div className="mt-0.5">{getImpactIcon(factor.impact)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {factor.factor}
                        </span>
                        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                          {Math.round(factor.weight)}%
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {factor.reason}
                      </p>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div
                          className={`h-full ${
                            factor.impact === "high"
                              ? "bg-red-500"
                              : factor.impact === "medium"
                                ? "bg-orange-500"
                                : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(factor.weight, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recomendações</CardTitle>
              <CardDescription>
                Ações sugeridas para mitigar o risco
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {explanation.recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400"
                  >
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
