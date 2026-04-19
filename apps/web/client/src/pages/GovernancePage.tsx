import { useEffect, useMemo, useState } from "react";
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
  AppNextActionCard,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPriorityBadge,
  AppSecondaryTabs,
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
  const [activeTab, setActiveTab] = useState<"overview" | "alerts" | "executions" | "history">("overview");

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
  const bottlenecks = normalizeArrayPayload<any>(summary.bottlenecks ?? summary.constraints ?? []);
  const failures = normalizeArrayPayload<any>(summary.operationalFailures ?? summary.failures ?? []);
  const institutionalPolicies = normalizeArrayPayload<any>(summary.policies ?? summary.institutionalPolicies ?? []);
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
    <PageWrapper title="Governança e Risco" subtitle="Risco, alerta e contenção prática para manter operação e receita protegidas.">
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
            hint: latestRisk >= 70 ? "alto impacto no fluxo operacional" : latestRisk >= 40 ? "atenção para evitar escalada" : "faixa controlada",
            tone: latestRisk >= 70 ? "critical" : latestRisk >= 40 ? "important" : "default",
          },
          { title: "Entidades em risco", value: String(entitiesAtRisk.length), hint: entitiesAtRisk.length > 0 ? "podem travar execução e receita" : "sem travas críticas detectadas" },
          { title: "Alertas abertos", value: String(metric(summary, "activeAlerts", "alertsCount")), hint: "urgência para contenção" },
          { title: "Recomendações prioritárias", value: String(recommendations.length), hint: "próxima ação para reduzir risco" },
        ]}
      />
      </KpiErrorBoundary>
      <AppSecondaryTabs
        items={[
          { value: "overview", label: "Visão geral" },
          { value: "alerts", label: "Alertas" },
          { value: "executions", label: "Execuções" },
          { value: "history", label: "Histórico" },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {(activeTab === "overview" || activeTab === "alerts") ? (
      <AppSectionBlock title="Estado operacional atual" subtitle="Por que a governança está neste estado e o que fazer agora" compact>
        <div className="space-y-3 text-sm text-[var(--text-secondary)]">
          <div className="flex flex-wrap items-center gap-2">
            <span>Estado:</span>
            <AppStatusBadge label={latestRisk >= 80 ? "SUSPENDED" : latestRisk >= 60 ? "RESTRICTED" : latestRisk >= 35 ? "WARNING" : "NORMAL"} />
            <AppPriorityBadge label={latestRisk >= 80 ? "Alta" : latestRisk >= 60 ? "Média" : "Baixa"} />
          </div>
          <p>
            Sinais principais: {entitiesAtRisk.length} entidades em risco, {metric(summary, "activeAlerts", "alertsCount")} alertas ativos e {recommendations.length} recomendações.
          </p>
          <p>Próximo passo recomendado: {recommendations[0] ? String(recommendations[0]?.title ?? recommendations[0]?.action ?? "Executar revisão de governança") : "Reexecutar governança para gerar plano de contenção"}.</p>
        </div>
      </AppSectionBlock>
      ) : null}

      {(activeTab === "overview" || activeTab === "history") ? (
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-8">
        <AppChartPanel title="Evolução do risco" description="Histórico compacto das últimas execuções.">
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
              <ChartContainer className="h-[180px] w-full" config={{ score: { label: "Risco" } }}>
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
        <div className="space-y-3 xl:col-span-4">
        <AppNextActionCard
          title="Risco real agora"
          description={entitiesAtRisk.length > 0
            ? `${entitiesAtRisk.length} entidades podem travar operação e ${metric(summary, "activeAlerts", "alertsCount")} alertas podem afetar receita.`
            : "Sem risco crítico aberto no momento, mas mantenha monitoramento ativo."}
          severity={latestRisk >= 70 ? "critical" : latestRisk >= 40 ? "high" : "medium"}
          metadata="contenção imediata"
          action={{ label: "Agir agora", onClick: () => void summaryQuery.refetch() }}
        />
        <AppNextActionCard
          title="Ação recomendada"
          description={recommendations[0]
            ? `${String(recommendations[0]?.title ?? recommendations[0]?.action ?? "Ação de contenção")} · área ${String(recommendations[0]?.area ?? "operacional")} · impacto esperado em estabilidade.`
            : "Reexecutar governança para gerar próxima ação de contenção orientada a impacto."}
          severity="high"
          metadata="próximo passo"
          action={{ label: "Aplicar ação", onClick: () => void Promise.all([summaryQuery.refetch(), runsQuery.refetch()]) }}
        />
        </div>
      </div>
      ) : null}

      <TrpcSectionErrorBoundary context="governance:entity-recommendations">
      {(activeTab === "overview" || activeTab === "alerts" || activeTab === "executions") ? (
      <div className="grid gap-3 xl:grid-cols-12">
        <AppSectionBlock title="Entidades em risco" subtitle="Itens reais apontados pela governança" className="xl:col-span-8">
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

        <AppSectionBlock title="Ações recomendadas" subtitle="Próximas ações úteis para reduzir risco" className="xl:col-span-4">
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
      ) : null}
      {(activeTab === "overview" || activeTab === "alerts") ? (
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <AppSectionBlock title="Gargalos operacionais" subtitle="Onde a operação está travando">
          {bottlenecks.length === 0 ? <AppPageEmptyState title="Sem gargalos críticos" description="Nenhum gargalo estrutural detectado na leitura atual." /> : (
            <ul className="space-y-2">
              {bottlenecks.slice(0, 5).map((item, index) => (
                <li key={`${String(item?.id ?? "b")}-${index}`} className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)]">
                  {String(item?.title ?? item?.name ?? item?.description ?? "Gargalo operacional identificado")}
                </li>
              ))}
            </ul>
          )}
        </AppSectionBlock>
        <AppSectionBlock title="Falhas operacionais" subtitle="Desvios que exigem correção">
          {failures.length === 0 ? <AppPageEmptyState title="Sem falhas abertas" description="Nenhuma falha crítica registrada nesta janela." /> : (
            <ul className="space-y-2">
              {failures.slice(0, 5).map((item, index) => (
                <li key={`${String(item?.id ?? "f")}-${index}`} className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                  {String(item?.title ?? item?.description ?? "Falha operacional")}
                </li>
              ))}
            </ul>
          )}
        </AppSectionBlock>
        <AppSectionBlock title="Estado institucional" subtitle="Políticas e aderência">
          {institutionalPolicies.length === 0 ? <AppPageEmptyState title="Sem políticas registradas" description="Backend não retornou políticas institucionais nesta organização." /> : (
            <ul className="space-y-2">
              {institutionalPolicies.slice(0, 5).map((policy, index) => (
                <li key={`${String(policy?.id ?? "p")}-${index}`} className="rounded-lg border border-[var(--border-subtle)] p-3">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{String(policy?.title ?? policy?.name ?? "Política")}</p>
                  <p className="text-xs text-[var(--text-muted)]">{String(policy?.status ?? "Sem status")}</p>
                </li>
              ))}
            </ul>
          )}
        </AppSectionBlock>
      </div>
      ) : null}
      {(activeTab === "overview" || activeTab === "executions") ? (
      <div className="mt-3">
        <AppNextActionCard
          title="Prioridade executiva"
          description="Governança deve responder claramente o que está errado hoje e o próximo passo executivo."
          severity={latestRisk >= 70 ? "critical" : latestRisk >= 40 ? "high" : "medium"}
          metadata="governança"
          action={{
            label: latestRisk >= 70 ? "Executar contenção imediata" : "Revisar recomendações",
            onClick: () => {
              void Promise.all([summaryQuery.refetch(), runsQuery.refetch()]);
            },
          }}
        />
      </div>
      ) : null}
      </TrpcSectionErrorBoundary>
    </PageWrapper>
  );
}
