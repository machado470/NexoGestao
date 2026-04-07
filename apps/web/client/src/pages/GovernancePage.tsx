import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getErrorMessage, getPayloadValue, getQueryUiState } from "@/lib/query-helpers";
import { useAuth } from "@/contexts/AuthContext";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, ShieldAlert } from "lucide-react";
import { DemoEnvironmentCta } from "@/components/DemoEnvironmentCta";

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
  const [, navigate] = useLocation();
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

  const queryState = getQueryUiState(
    [summaryQuery, runsQuery, autoScoreQuery, alertsQuery],
    hasAnyData
  );

  const institutionalRiskScore =
    Number(
      summary?.institutionalRiskScore ??
        autoScore?.institutionalRiskScore ??
        autoScore?.score ??
        0
    ) || 0;

  if (isInitializing) {
    return (
      <PageShell>
        <PageHero eyebrow="Governança" title="Governança" description="Validando sessão e permissões." />
        <SurfaceSection className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando sessão...
        </SurfaceSection>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageShell>
        <PageHero eyebrow="Governança" title="Governança" description="Sua sessão não está ativa." />
      </PageShell>
    );
  }

  if (queryState.isInitialLoading) {
    return (
      <PageShell>
        <PageHero eyebrow="Governança" title="Governança" description="Carregando leituras de risco institucional." />
        <SurfaceSection className="flex min-h-[180px] items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Montando painel de governança...
        </SurfaceSection>
      </PageShell>
    );
  }

  if (queryState.shouldBlockForError) {
    return (
      <PageShell>
        <PageHero eyebrow="Governança" title="Governança" description="Não foi possível montar os blocos de governança." />
        <SurfaceSection className="border-red-200 text-red-700 dark:border-red-900/40 dark:text-red-300">{errorMessage}</SurfaceSection>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Governança"
        title="Governança"
        description="Visão de score institucional e histórico de execução com o mesmo padrão visual do painel executivo."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate("/timeline")}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Abrir timeline
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard/operations")}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Ver riscos operacionais
            </button>
          </div>
        }
      />

      {queryState.hasBackgroundUpdate ? (
        <div className="rounded border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">
          Atualizando governança em segundo plano...
        </div>
      ) : null}

      {hasError && !queryState.shouldBlockForError ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="nexo-kpi-card">
          <p className="text-sm opacity-70">Score</p>
          <p className="text-xl font-semibold">{institutionalRiskScore}</p>
        </div>

        <div className="nexo-kpi-card">
          <p className="text-sm opacity-70">Nível</p>
          <p className="text-xl font-semibold">
            {formatRiskLevel(institutionalRiskScore)}
          </p>
        </div>
      </div>

      {runs.length > 0 ? (
        <SurfaceSection className="space-y-2">
          <h2 className="font-semibold">Histórico</h2>

          {runs.map((r: any) => (
            <div key={r.id} className="rounded border p-3">
              {formatDate(r.createdAt)} - {Number(r.institutionalRiskScore ?? r.score ?? 0)}
            </div>
          ))}
        </SurfaceSection>
      ) : (
        <SurfaceSection className="space-y-3">
          <EmptyState
            icon={<ShieldAlert className="h-7 w-7" />}
            title="Histórico de governança ainda vazio"
            description="Quando novas execuções de score acontecerem, este histórico mostrará evolução de risco e rastreabilidade."
            action={{
              label: "Atualizar histórico",
              onClick: () => void runsQuery.refetch(),
            }}
          />
          <DemoEnvironmentCta />
        </SurfaceSection>
      )}
    </PageShell>
  );
}
