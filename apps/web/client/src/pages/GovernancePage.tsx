import { useMemo } from "react";
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

function metric(summary: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(summary?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

export default function GovernancePage() {
  const summaryQuery = trpc.governance.summary.useQuery(undefined, { retry: false });
  const runsQuery = trpc.governance.runs.useQuery({ limit: 12 }, { retry: false });

  const summary = useMemo(
    () => (normalizeObjectPayload<any>(summaryQuery.data) ?? {}) as Record<string, any>,
    [summaryQuery.data]
  );
  const runs = useMemo(() => normalizeArrayPayload<any>(runsQuery.data), [runsQuery.data]);
  const hasRunsData = runs.length > 0;
  const hasSummaryData = Boolean(summaryQuery.data);

  const riskSeries = runs
    .map((run, index) => ({
      label: String(run?.createdAt ? new Date(String(run.createdAt)).toLocaleDateString("pt-BR") : `Execução ${index + 1}`),
      score: Number(run?.riskScore ?? run?.score ?? run?.overallRisk ?? 0),
    }))
    .filter((item) => Number.isFinite(item.score));

  const entitiesAtRisk = normalizeArrayPayload<any>(summary.entitiesAtRisk ?? summary.riskEntities ?? []);
  const recommendations = normalizeArrayPayload<any>(summary.recommendations ?? summary.nextActions ?? []);

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

      <AppKpiRow
        items={[
          { label: "Risco atual", value: `${metric(summary, "riskScore", "overallRisk")}/100`, trend: 0, context: "último cálculo" },
          { label: "Alertas ativos", value: String(metric(summary, "activeAlerts", "alertsCount")), trend: 0, context: "monitoramento contínuo" },
          { label: "Eventos críticos", value: String(metric(summary, "criticalEvents", "criticalCount")), trend: 0, context: "janela atual" },
          { label: "Entidades em risco", value: String(entitiesAtRisk.length), trend: 0, context: "exigem atenção" },
        ]}
      />

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
          ) : riskSeries.length === 0 ? (
            <AppPageEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: rodar governança e acompanhar evolução." />
          ) : (
            <ChartContainer className="h-[240px] w-full" config={{ score: { label: "Risco" } }}>
              <LineChart data={riskSeries}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line dataKey="score" stroke="var(--brand-primary)" strokeWidth={3} />
              </LineChart>
            </ChartContainer>
          )}
        </AppChartPanel>
      </div>

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
    </PageWrapper>
  );
}
