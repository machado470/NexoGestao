import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { getErrorMessage, getPayloadValue } from "@/lib/query-helpers";
import { useAuth } from "@/contexts/AuthContext";

/* ================= HELPERS ================= */

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

function formatRiskLevel(score?: number | null) {
  const v = Number(score ?? 0);
  if (v >= 80) return "Crítico";
  if (v >= 60) return "Alto";
  if (v >= 40) return "Moderado";
  if (v > 0) return "Baixo";
  return "Sem score";
}

/* ================= PAGE ================= */

export default function GovernancePage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canLoadGovernance = isAuthenticated;

  const summaryQuery = trpc.governance.summary.useQuery(undefined, {
    enabled: canLoadGovernance,
    retry: false,
  });

  const runsQuery = trpc.governance.runs.useQuery(
    { limit: 20 },
    {
      enabled: canLoadGovernance,
      retry: false,
    }
  );

  const autoScoreQuery = trpc.governance.autoScore.useQuery(undefined, {
    enabled: canLoadGovernance,
    retry: false,
  });

  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    enabled: canLoadGovernance,
    retry: false,
  });

  const summary = useMemo(() => {
    const payload = getPayloadValue<any>(summaryQuery.data);
    return payload && typeof payload === "object" ? payload : null;
  }, [summaryQuery.data]);

  const runs = useMemo(() => {
    const payload = getPayloadValue<any>(runsQuery.data);

    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.results)) return payload.results;

    return [];
  }, [runsQuery.data]);

  const autoScore = useMemo(() => {
    const payload = getPayloadValue<any>(autoScoreQuery.data);
    return payload && typeof payload === "object" ? payload : null;
  }, [autoScoreQuery.data]);

  const alerts = useMemo(() => {
    const payload = getPayloadValue<any>(alertsQuery.data);
    return payload && typeof payload === "object" ? payload : null;
  }, [alertsQuery.data]);

  const hasNormalizedSummary = summaryQuery.data !== undefined;
  const hasNormalizedRuns = runsQuery.data !== undefined;
  const hasNormalizedAutoScore = autoScoreQuery.data !== undefined;
  const hasNormalizedAlerts = alertsQuery.data !== undefined;
  const hasAnyData =
    hasNormalizedSummary ||
    hasNormalizedRuns ||
    hasNormalizedAutoScore ||
    hasNormalizedAlerts;

  const hasError =
    summaryQuery.isError ||
    runsQuery.isError ||
    autoScoreQuery.isError ||
    alertsQuery.isError;

  const errorMessage =
    getErrorMessage(summaryQuery.error, "") ||
    getErrorMessage(runsQuery.error, "") ||
    getErrorMessage(autoScoreQuery.error, "") ||
    getErrorMessage(alertsQuery.error, "") ||
    "Erro ao carregar governança";

  const hasAnyActiveLoading =
    summaryQuery.isLoading ||
    runsQuery.isLoading ||
    autoScoreQuery.isLoading ||
    alertsQuery.isLoading;

  const isInitialLoading = hasAnyActiveLoading && !hasAnyData;

  const shouldBlockForError = hasError && !hasAnyData;

  const institutionalRiskScore =
    Number(
      summary?.institutionalRiskScore ??
        autoScore?.institutionalRiskScore ??
        autoScore?.score ??
        0
    ) || 0;

  if (isInitializing) {
    return <div className="p-6">Carregando sessão...</div>;
  }

  if (!isAuthenticated) {
    return <div className="p-6">Faça login</div>;
  }

  if (isInitialLoading) {
    return <div className="p-6">Carregando...</div>;
  }

  if (shouldBlockForError) {
    return <div className="p-6 text-red-500">{errorMessage}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Governança</h1>

      {hasError && !shouldBlockForError ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border p-4">
          <p className="text-sm opacity-70">Score</p>
          <p className="text-xl font-semibold">{institutionalRiskScore}</p>
        </div>

        <div className="rounded border p-4">
          <p className="text-sm opacity-70">Nível</p>
          <p className="text-xl font-semibold">
            {formatRiskLevel(institutionalRiskScore)}
          </p>
        </div>
      </div>

      {runs.length > 0 ? (
        <div className="space-y-2">
          <h2 className="font-semibold">Histórico</h2>

          {runs.map((r: any) => (
            <div key={r.id} className="rounded border p-3">
              {formatDate(r.createdAt)} - {Number(r.institutionalRiskScore ?? r.score ?? 0)}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded border p-4 text-sm opacity-70">
          Nenhum histórico de governança disponível ainda.
        </div>
      )}
    </div>
  );
}
