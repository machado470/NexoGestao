import { useMemo, useState } from "react";
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

function toLabel(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

export default function TimelinePage() {
  const [filter, setFilter] = useState("");
  const timelineQuery = trpc.nexo.timeline.listByOrg.useQuery({ limit: 200 }, { retry: false });
  const events = useMemo(() => normalizeArrayPayload<any>(timelineQuery.data), [timelineQuery.data]);

  const filteredEvents = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) => {
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
  }, [events, filter]);

  const chartData = useMemo(() => {
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

  const criticalEvents = filteredEvents.filter((event) =>
    ["critical", "error", "failed"].includes(String(event?.severity ?? event?.status ?? "").toLowerCase())
  ).length;
  const uniqueEntities = new Set(filteredEvents.map((event) => String(event?.entityId ?? "")).filter(Boolean)).size;
  const uniqueActors = new Set(filteredEvents.map((event) => String(event?.actorId ?? event?.actorName ?? "")).filter(Boolean)).size;

  return (
    <PageWrapper title="Timeline Auditável" subtitle="Rastreabilidade operacional padronizada entre módulos.">
      <OperationalTopCard
        contextLabel="Direção de auditoria"
        title="Histórico operacional rastreável"
        description="Histórico operacional real com rastreabilidade por entidade e ação."
        primaryAction={(
          <Button type="button" variant="outline" onClick={() => void timelineQuery.refetch()}>
            Atualizar timeline
          </Button>
        )}
      />

      <AppKpiRow
        items={[
          { label: "Eventos", value: String(filteredEvents.length), trend: 0, context: "janela atual" },
          { label: "Críticos", value: String(criticalEvents), trend: 0, context: "pedem intervenção" },
          { label: "Entidades", value: String(uniqueEntities), trend: 0, context: "impactadas" },
          { label: "Usuários", value: String(uniqueActors), trend: 0, context: "com ação registrada" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Volume de eventos por hora" description="Distribuição real dos eventos retornados pelo backend.">
          {timelineQuery.isLoading ? (
            <AppLoadingState rows={2} />
          ) : chartData.length === 0 ? (
            <AppEmptyState title="Nenhum dado disponível ainda" description="Ação recomendada: executar uma operação e voltar nesta tela." />
          ) : (
            <ChartContainer className="h-[220px] w-full" config={{ total: { label: "Eventos" } }}>
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--brand-primary)" />
              </BarChart>
            </ChartContainer>
          )}
        </AppChartPanel>
      </div>

      <AppSectionBlock title="Feed de eventos" subtitle="Sem placeholders: somente eventos reais.">
        <AppFiltersBar>
          <Input
            placeholder="Filtrar por entidade, ação, tipo ou usuário"
            className="max-w-md"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </AppFiltersBar>

        {timelineQuery.isLoading ? (
          <AppLoadingState rows={5} />
        ) : filteredEvents.length === 0 ? (
          <AppEmptyState title="Nenhum evento encontrado" description="Ajuste o filtro ou execute ações operacionais para gerar histórico." />
        ) : (
          <ul className="space-y-2">
            {filteredEvents.map((event) => (
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
        )}
      </AppSectionBlock>
    </PageWrapper>
  );
}
