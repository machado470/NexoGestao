import { useEffect, useMemo } from "react";
import { Line, LineChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload, normalizeObjectPayload } from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { Button } from "@/components/design-system";
import {
  AppChartPanel,
  AppKpiRow,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { formatDelta, percentDelta, trendFromDelta } from "@/lib/operational/kpi";
import { safeChartData } from "@/lib/safeChartData";
import { ChartErrorBoundary } from "@/components/ChartErrorBoundary";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";
import { TrpcSectionErrorBoundary } from "@/components/TrpcSectionErrorBoundary";
import { setBootPhase } from "@/lib/bootPhase";

function metric(summary: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(summary?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

export default function GovernancePage() {
  setBootPhase("PAGE:Governança");
  useRenderWatchdog("GovernancePage");
  const summaryQuery = trpc.governance.summary.useQuery(undefined, { retry: false });
  const runsQuery = trpc.governance.runs.useQuery({ limit: 12 }, { retry: false });

  const summary = useMemo(
    () => (normalizeObjectPayload<any>(summaryQuery.data) ?? {}) as Record<string, any>,
    [summaryQuery.data]
  );
  const runs = useMemo(() => normalizeArrayPayload<any>(runsQuery.data), [runsQuery.data]);
  const hasRunsData = runs.length > 0;
  const hasSummaryData = Boolean(summaryQuery.data);
  usePageDiagnostics({
    page: "governance",
    isLoading: (runsQuery.isLoading && !hasRunsData) || (summaryQuery.isLoading && !hasSummaryData),
    hasError: Boolean((runsQuery.error && !hasRunsData) || (summaryQuery.error && !hasSummaryData)),
    isEmpty:
      !runsQuery.isLoading &&
      !summaryQuery.isLoading &&
      !runsQuery.error &&
      !summaryQuery.error &&
      runs.length === 0,
    dataCount: runs.length,
  });

  const riskSeriesRaw = runs
    .map((run, index) => ({
      label: String(run?.createdAt ? new Date(String(run.createdAt)).toLocaleDateString("pt-BR") : `Execução ${index + 1}`),
      score: Number(run?.riskScore ?? run?.score ?? run?.overallRisk ?? 0),
    }))
    .filter((item) => Number.isFinite(item.score));
  const riskSeries = useMemo(
    () => safeChartData<{ label: string; score: number }>(riskSeriesRaw, ["score"]),
    [riskSeriesRaw]
  );

  const entitiesAtRisk = normalizeArrayPayload<any>(summary.entitiesAtRisk ?? summary.riskEntities ?? []);
  const recommendations = normalizeArrayPayload<any>(summary.recommendations ?? summary.nextActions ?? []);
  const latestRisk = Number(riskSeries.data[riskSeries.data.length - 1]?.score ?? metric(summary, "riskScore", "overallRisk"));
  const previousRisk = Number(riskSeries.data[riskSeries.data.length - 2]?.score ?? Number.NaN);
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] governance");
  }, []);
  useEffect(() => {
    if (!summaryQuery.error && !runsQuery.error) return;
    // eslint-disable-next-line no-console
    console.error("[TRPC ERROR] governance_query_error", {
      summary: summaryQuery.error?.message,
      runs: runsQuery.error?.message,
    });
  }, [runsQuery.error, summaryQuery.error]);

  return (
    <PageWrapper title="Governança e Risco" subtitle="Leitura de risco e contenção com o mesmo contrato operacional das demais telas.">
      <OperationalTopCard
        contextLabel="Direção de governança"
        title="Risco e contenção operacional"
        description="Sinais reais de risco e ações de contenção operacional."
        primaryAction={(
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void Promise.all([summaryQuery.refetch(), runsQuery.refetch()]);
            }}
          >
            Recarregar sinais
          </Button>
        )}
      />

      <KpiErrorBoundary context="governance:kpi">
        <AppKpiRow
        items={[
          {
            title: "Score de risco",
            value: `${latestRisk}/100`,
            delta: formatDelta(percentDelta(latestRisk, previousRisk)),
            trend: trendFromDelta(percentDelta(latestRisk, previousRisk)),
            hint: "última execução vs anterior",
            tone: latestRisk >= 70 ? "critical" : latestRisk >= 40 ? "important" : "default",
          },
          { title: "Entidades em risco", value: String(entitiesAtRisk.length), hint: "exigem contenção" },
          { title: "Alertas abertos", value: String(metric(summary, "activeAlerts", "alertsCount")), hint: "monitoramento contínuo" },
          { title: "Recomendações prioritárias", value: String(recommendations.length), hint: "ações sugeridas" },
        ]}
      />
      </KpiErrorBoundary>

      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Evolução do risco" description="Histórico real das últimas execuções de governança.">
          {runsQuery.isLoading && !hasRunsData ? (
            <AppPageLoadingState description="Carregando histórico de risco..." />
          ) : runsQuery.error && !hasRunsData ? (
            <AppPageErrorState
              description={runsQuery.error?.message ?? "Falha ao carregar histórico de risco."}
              actionLabel="Tentar novamente"
              onAction={() => void runsQuery.refetch()}
            />
          ) : !riskSeries.isValid ? (
            <AppPageEmptyState title="Erro ao renderizar gráfico" description={riskSeries.reason ?? "Dados inválidos do gráfico."} />
          ) : riskSeries.data.length === 0 ? (
            <AppPageEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: rodar governança e acompanhar evolução." />
          ) : (
            <ChartErrorBoundary context="governance:risk-chart">
              <ChartContainer className="h-[240px] w-full" config={{ score: { label: "Risco" } }}>
                <LineChart data={riskSeries.data}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line dataKey="score" stroke="var(--brand-primary)" strokeWidth={3} />
                </LineChart>
              </ChartContainer>
            </ChartErrorBoundary>
          )}
        </AppChartPanel>
      </div>

      <TrpcSectionErrorBoundary context="governance:entity-recommendations">
      <div className="grid gap-3 xl:grid-cols-2">
        <AppSectionBlock title="Entidades em risco" subtitle="Itens reais apontados pela governança">
          {summaryQuery.isLoading && !hasSummaryData ? (
            <AppPageLoadingState description="Carregando entidades em risco..." />
          ) : summaryQuery.error && !hasSummaryData ? (
            <AppPageErrorState
              description={summaryQuery.error?.message ?? "Falha ao carregar entidades em risco."}
              actionLabel="Tentar novamente"
              onAction={() => void summaryQuery.refetch()}
            />
          ) : entitiesAtRisk.length === 0 ? (
            <AppPageEmptyState title="Nenhuma entidade em risco" description="Sem desvios críticos detectados nesta organização." />
          ) : (
            <ul className="space-y-2">
              {entitiesAtRisk.map((entity) => (
                <li key={String(entity?.id ?? entity?.entityId)} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] p-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{String(entity?.name ?? entity?.entityName ?? "Entidade")}</p>
                    <p className="text-xs text-[var(--text-muted)]">{String(entity?.reason ?? entity?.context ?? "Sem contexto detalhado")}</p>
                  </div>
                  <AppStatusBadge label={String(entity?.level ?? entity?.riskLevel ?? "WARNING")} />
                </li>
              ))}
            </ul>
          )}
        </AppSectionBlock>

        <AppSectionBlock title="Ações recomendadas" subtitle="Próximas ações úteis para reduzir risco">
          {summaryQuery.isLoading && !hasSummaryData ? (
            <AppPageLoadingState description="Carregando recomendações..." />
          ) : summaryQuery.error && !hasSummaryData ? (
            <AppPageErrorState
              description={summaryQuery.error?.message ?? "Falha ao carregar recomendações."}
              actionLabel="Tentar novamente"
              onAction={() => void summaryQuery.refetch()}
            />
          ) : recommendations.length === 0 ? (
            <AppPageEmptyState title="Nenhuma recomendação disponível" description="Execute operações para gerar insights de governança." />
          ) : (
            <ul className="space-y-2">
              {recommendations.map((item, index) => (
                <li key={`${String(item?.id ?? item?.action ?? "rec")}-${index}`} className="rounded-lg border border-[var(--border-subtle)] p-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{String(item?.title ?? item?.action ?? "Ação recomendada")}</p>
                  <p className="text-xs text-[var(--text-muted)]">{String(item?.description ?? item?.impact ?? "Sem descrição detalhada")}</p>
                </li>
              ))}
            </ul>
          )}
        </AppSectionBlock>
      </div>
      </TrpcSectionErrorBoundary>
    </PageWrapper>
  );
}
