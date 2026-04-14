import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { trpc } from "@/lib/trpc";
import { normalizeArrayPayload } from "@/lib/query-helpers";
import { PageWrapper } from "@/components/operating-system/Wrappers";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import { Button } from "@/components/design-system";
import {
  AppChartPanel,
  AppEmptyState,
  AppFiltersBar,
  AppKpiRow,
  AppLoadingState,
  AppSectionBlock,
  Input,
} from "@/components/internal-page-system";
import { usePageDiagnostics } from "@/hooks/usePageDiagnostics";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { formatDelta, getDayWindow, percentDelta, safeDate, trendFromDelta } from "@/lib/operational/kpi";
import { safeChartData } from "@/lib/safeChartData";
import { ChartErrorBoundary } from "@/components/ChartErrorBoundary";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";
import { TrpcSectionErrorBoundary } from "@/components/TrpcSectionErrorBoundary";
import { setBootPhase } from "@/lib/bootPhase";

function toLabel(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

export default function TimelinePage() {
  setBootPhase("PAGE:Timeline");
  useRenderWatchdog("TimelinePage");
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [limit, setLimit] = useState(120);
  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery({ limit }, { retry: false });
  const events = useMemo(() => normalizeArrayPayload<any>(timelineQuery.data), [timelineQuery.data]);
  usePageDiagnostics({
    page: "timeline",
    isLoading: timelineQuery.isLoading,
    hasError: Boolean(timelineQuery.error),
    isEmpty: !timelineQuery.isLoading && !timelineQuery.error && events.length === 0,
    dataCount: events.length,
  });

  const filteredEvents = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return events.filter((event) => {
      const date = safeDate(event?.createdAt);
      if (typeFilter !== "all" && String(event?.type ?? event?.action ?? "").toLowerCase() !== typeFilter) return false;
      if (entityFilter !== "all" && String(event?.entityType ?? "").toLowerCase() !== entityFilter) return false;
      if (periodFilter === "24h" && (!date || Date.now() - date.getTime() > 1000 * 60 * 60 * 24)) return false;
      if (periodFilter === "7d" && (!date || Date.now() - date.getTime() > 1000 * 60 * 60 * 24 * 7)) return false;
      if (!q) return true;
      const text = [
        event?.action,
        event?.type,
        event?.entityType,
        event?.entityId,
        event?.actorName,
        event?.title,
        event?.description,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return text.includes(q);
    });
  }, [entityFilter, events, filter, periodFilter, typeFilter]);

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, any[]>();
    filteredEvents.forEach((event) => {
      const key = event?.createdAt ? new Date(String(event.createdAt)).toLocaleDateString("pt-BR") : "Sem data";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(event);
    });
    return Array.from(groups.entries());
  }, [filteredEvents]);

  const chartDataRaw = useMemo(() => {
    const buckets = new Map<string, number>();
    filteredEvents.forEach((event) => {
      const createdAt = event?.createdAt ? new Date(String(event.createdAt)) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return;
      const label = `${String(createdAt.getHours()).padStart(2, "0")}h`;
      buckets.set(label, (buckets.get(label) ?? 0) + 1);
    });
    return [...buckets.entries()]
      .map(([hour, total]) => ({ hour, total }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [filteredEvents]);
  const chartData = useMemo(
    () => safeChartData<{ hour: string; total: number }>(chartDataRaw, ["total"]),
    [chartDataRaw]
  );

  const criticalEvents = filteredEvents.filter((event) =>
    ["critical", "error", "failed"].includes(String(event?.severity ?? event?.status ?? "").toLowerCase())
  ).length;
  const uniqueEntities = new Set(filteredEvents.map((event) => String(event?.entityId ?? "")).filter(Boolean)).size;
  const currentDay = getDayWindow(0);
  const previousDay = getDayWindow(1);
  const recentEvents = events.filter((event) => {
    const date = safeDate(event?.createdAt);
    return Boolean(date && date >= currentDay.start && date < currentDay.end);
  }).length;
  const recentPrevious = events.filter((event) => {
    const date = safeDate(event?.createdAt);
    return Boolean(date && date >= previousDay.start && date < previousDay.end);
  }).length;
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] timeline");
  }, []);
  useEffect(() => {
    if (!timelineQuery.error) return;
    // eslint-disable-next-line no-console
    console.error("[TRPC ERROR] timeline_query_error", timelineQuery.error.message);
  }, [timelineQuery.error]);
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[CHART DATA] timeline.events_by_hour", chartData);
  }, [chartData]);

  return (
    <PageWrapper title="Timeline Auditável" subtitle="Rastreabilidade operacional padronizada entre módulos.">
      <OperationalTopCard
        contextLabel="Direção de auditoria"
        title="Histórico operacional rastreável"
        description="Histórico operacional real com rastreabilidade por entidade e ação."
        primaryAction={(
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void timelineQuery.refetch()}>
              Atualizar timeline
            </Button>
            <Button type="button" onClick={() => setLimit((prev) => prev + 120)}>
              Carregar mais
            </Button>
          </div>
        )}
      />

      <KpiErrorBoundary context="timeline:kpi">
        <AppKpiRow
        items={[
          {
            title: "Eventos recentes",
            value: String(recentEvents),
            delta: formatDelta(percentDelta(recentEvents, recentPrevious)),
            trend: trendFromDelta(percentDelta(recentEvents, recentPrevious)),
            hint: "hoje vs ontem",
          },
          { title: "Eventos críticos", value: String(criticalEvents), hint: "pedem intervenção" },
          { title: "Entidades impactadas", value: String(uniqueEntities), hint: "na janela filtrada" },
        ]}
      />
      </KpiErrorBoundary>

      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Volume de eventos por hora" description="Distribuição real dos eventos retornados pelo backend.">
          {timelineQuery.isLoading ? (
            <AppLoadingState rows={2} />
          ) : !chartData.isValid ? (
            <AppEmptyState title="Erro ao renderizar gráfico" description={chartData.reason ?? "Dados inválidos."} />
          ) : chartData.data.length === 0 ? (
            <AppEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: executar uma operação e voltar nesta tela." />
          ) : (
            <ChartErrorBoundary context="timeline:events-chart">
              <ChartContainer className="h-[220px] w-full" config={{ total: { label: "Eventos" } }}>
                <BarChart data={chartData.data}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="var(--brand-primary)" />
                </BarChart>
              </ChartContainer>
            </ChartErrorBoundary>
          )}
        </AppChartPanel>
      </div>

      <TrpcSectionErrorBoundary context="timeline:events-feed">
      <AppSectionBlock title="Feed de eventos" subtitle="Sem placeholders: somente eventos reais.">
        <AppFiltersBar>
          <Input
            placeholder="Filtrar por entidade, ação, tipo ou usuário"
            className="max-w-md"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <Input placeholder="Tipo (all/charge.created)" className="max-w-[220px]" value={typeFilter === "all" ? "" : typeFilter} onChange={(event) => setTypeFilter(event.target.value.trim().toLowerCase() || "all")} />
          <Input placeholder="Entidade (all/customer)" className="max-w-[210px]" value={entityFilter === "all" ? "" : entityFilter} onChange={(event) => setEntityFilter(event.target.value.trim().toLowerCase() || "all")} />
          <Input placeholder="Período (all/24h/7d)" className="max-w-[190px]" value={periodFilter === "all" ? "" : periodFilter} onChange={(event) => setPeriodFilter(event.target.value.trim().toLowerCase() || "all")} />
          <p className="text-xs text-[var(--text-muted)]">Mostrando até {limit} eventos por carregamento.</p>
        </AppFiltersBar>

        {timelineQuery.isLoading ? (
          <AppLoadingState rows={5} />
        ) : filteredEvents.length === 0 ? (
          <AppEmptyState title="Nenhum evento encontrado" description="Ajuste o filtro ou execute ações operacionais para gerar histórico." />
        ) : (
          <div className="space-y-3">
            {groupedEvents.map(([dateLabel, items]) => (
              <div key={dateLabel} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">{dateLabel}</p>
                <ul className="space-y-2">
                  {items.map((event) => (
                    <li key={String(event?.id ?? `${event?.entityId}-${event?.createdAt}`)} className="rounded-lg border border-[var(--border-subtle)] p-3">
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {toLabel(event?.title ?? event?.action ?? event?.type, "Evento operacional")}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {toLabel(event?.entityType, "Entidade")} #{toLabel(event?.entityId, "—")} · {toLabel(event?.actorName, "Sistema")} · {event?.createdAt ? new Date(String(event.createdAt)).toLocaleString("pt-BR") : "sem data"}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="pt-1">
              <Button type="button" variant="outline" onClick={() => setLimit((prev) => prev + 120)}>
                Carregar mais eventos
              </Button>
            </div>
          </div>
        )}
      </AppSectionBlock>
      </TrpcSectionErrorBoundary>
    </PageWrapper>
  );
}
