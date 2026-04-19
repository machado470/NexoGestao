import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/design-system";
import {
  AppChartPanel,
  AppKpiRow,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppSectionBlock,
  appSelectionPillClasses,
} from "@/components/internal-page-system";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "month", label: "Mês atual" },
] as const;

type Period = (typeof PERIODS)[number]["value"];

interface QueueItem {
  id: string;
  client: string;
  value: string;
  summary: string;
  intelligenceLabel?: string;
  status: "overdue" | "pending" | "ready";
  priority: "critical" | "attention" | "healthy";
  recommendedAction:
    | "Cobrar via WhatsApp"
    | "Agendar lembrete"
    | "Registrar pagamento";
  onAction: () => void;
}

interface FinanceOverviewProps {
  kpis: Array<{
    title: string;
    value: string;
    hint?: string;
    delta?: string;
    trend?: "up" | "down" | "neutral";
    tone?: "default" | "important" | "critical";
    onClick?: () => void;
    ctaLabel?: string;
  }>;
  revenueData: Array<{
    label: string;
    revenue: number;
    projected: number;
    overdue: number;
  }>;
  revenueDataByPeriod: Record<
    Period,
    Array<{
      label: string;
      revenue: number;
      projected: number;
      overdue: number;
    }>
  >;
  revenueLoading: boolean;
  revenueError?: string;
  isRevenueValid: boolean;
  revenueInvalidReason?: string;
  risk: {
    riskAmount: string;
    overdueCount: number;
    dueToday: number;
    dueSoon: number;
  };
  goToMode: (mode: "pending" | "overdue" | "paid") => void;
  openCreate: () => void;
  cobrarAgora: () => void;
  queueItems: QueueItem[];
}

export function FinanceOverview(props: FinanceOverviewProps) {
  const [period, setPeriod] = useState<Period>("30d");
  const data = useMemo(
    () => props.revenueDataByPeriod[period] ?? props.revenueData,
    [period, props.revenueData, props.revenueDataByPeriod]
  );

  const totalOverdueEvents = data.reduce(
    (acc, item) => acc + Number(item.overdue ?? 0),
    0
  );
  const revenueStart = Number(data[0]?.revenue ?? 0);
  const revenueEnd = Number(data[data.length - 1]?.revenue ?? 0);
  const revenueDeltaPercent =
    revenueStart > 0 ? ((revenueEnd - revenueStart) / revenueStart) * 100 : 0;
  const dueSoon72hCount = props.queueItems.filter(
    item => item.status === "pending" && item.priority === "attention"
  ).length;
  const isRiskHigh = props.risk.overdueCount > 0 || props.risk.dueToday > 0;
  const nextBestAction = useMemo(() => {
    if (props.risk.overdueCount > 0) {
      return {
        headline: "Priorizar vencidas",
        context: `${props.risk.overdueCount} item(ns) exigem ação imediata · ${props.risk.riskAmount} em risco.`,
        cta: "Ir para vencidas",
        onClick: () => props.goToMode("overdue"),
      };
    }
    if (props.risk.dueToday > 0 || dueSoon72hCount > 0) {
      const urgentCount = props.risk.dueToday + dueSoon72hCount;
      return {
        headline: "Cobrar hoje",
        context: `${urgentCount} cobrança(s) pedem contato agora.`,
        cta: "Cobrar via WhatsApp",
        onClick: props.cobrarAgora,
      };
    }
    return {
      headline: "Registrar recebimento",
      context: "Sem urgências no caixa. Finalize baixas pendentes.",
      cta: "Registrar pagamento",
      onClick: () => props.goToMode("paid"),
    };
  }, [
    dueSoon72hCount,
    props.cobrarAgora,
    props.goToMode,
    props.risk.dueToday,
    props.risk.overdueCount,
    props.risk.riskAmount,
  ]);

  return (
    <div className="space-y-3.5">
      <AppKpiRow items={props.kpis} />

      <AppChartPanel
        title="Receita e previsão"
        description="Recebido, previsto e vencimentos no período."
      >
        <div className="mb-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/55 px-3 py-2.5 transition-colors hover:border-[var(--border-strong)]">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {revenueDeltaPercent >= 0
              ? `Receita subiu ${Math.abs(revenueDeltaPercent).toFixed(1)}% no período.`
              : `Receita caiu ${Math.abs(revenueDeltaPercent).toFixed(1)}% no período.`}
          </p>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {props.risk.overdueCount > 0
              ? `${props.risk.riskAmount} em risco agora · priorize vencidas nesta janela.`
              : dueSoon72hCount > 0
                ? `${dueSoon72hCount} cobrança(s) vencem nas próximas 72h.`
                : "Sem risco crítico na janela atual."}
          </p>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PERIODS.map(item => (
            <button
              key={item.value}
              type="button"
              className={appSelectionPillClasses(period === item.value)}
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {props.revenueLoading && data.length === 0 ? (
          <AppPageLoadingState description="Carregando evolução de receita..." />
        ) : props.revenueError && data.length === 0 ? (
          <AppPageErrorState
            description={props.revenueError}
            actionLabel="Criar cobrança"
            onAction={props.openCreate}
          />
        ) : !props.isRevenueValid ? (
          <AppPageEmptyState
            title="Erro ao renderizar gráfico"
            description={
              props.revenueInvalidReason ?? "Dados inválidos do gráfico."
            }
          />
        ) : data.length === 0 ? (
          <AppPageEmptyState
            title="Ainda sem histórico"
            description="Registre pagamentos para começar a leitura do caixa."
          />
        ) : (
          <ChartContainer
            className="h-[260px] w-full lg:h-[272px]"
            config={{
              revenue: { label: "Recebido", color: "hsl(var(--accent))" },
              projected: {
                label: "Previsto",
                color: "hsl(194 70% 56%)",
              },
              overdue: {
                label: "Vencidas",
                color: "hsl(6 82% 64%)",
              },
            }}
          >
            <ComposedChart
              data={data}
              margin={{ top: 12, right: 10, bottom: 4, left: -8 }}
            >
              <CartesianGrid
                strokeDasharray="2 4"
                vertical={false}
                stroke="color-mix(in srgb, var(--border-subtle) 45%, transparent)"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={22}
                tickMargin={10}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={46}
                tick={{ fontSize: 11 }}
                tickMargin={8}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="border-[var(--border-subtle)] bg-[var(--surface-elevated)]/95"
                    labelFormatter={value => `Período ${String(value)}`}
                    formatter={(value, name, item) => {
                      const metric =
                        name === "revenue"
                          ? "Recebido"
                          : name === "projected"
                            ? "Previsto"
                            : "Vencidas";
                      const formatted =
                        name === "overdue"
                          ? `${Number(value).toLocaleString("pt-BR")}`
                          : `R$ ${Number(value).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`;
                      return (
                        <div className="flex w-full items-center justify-between gap-3 text-xs">
                          <span className="text-muted-foreground">
                            {metric}
                          </span>
                          <span className="font-mono text-foreground">
                            {formatted}
                          </span>
                          {name === "revenue" ? (
                            <span className="sr-only">
                              Previsto{" "}
                              {Number((item as any)?.payload?.projected ?? 0)}
                            </span>
                          ) : null}
                        </div>
                      );
                    }}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="projected"
                stroke="var(--color-projected)"
                fill="var(--color-projected)"
                fillOpacity={0.14}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={2.5}
                dot={{
                  r: 2.5,
                  fill: "var(--color-revenue)",
                  strokeWidth: 0,
                }}
                activeDot={{
                  r: 5,
                  fill: "var(--color-revenue)",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
              />
            </ComposedChart>
          </ChartContainer>
        )}

        <div className="mt-2 text-xs text-[var(--text-muted)]">
          {totalOverdueEvents > 0
            ? `${totalOverdueEvents} pontos de vencimento no período selecionado.`
            : "Sem eventos de vencimento no período selecionado."}
        </div>
      </AppChartPanel>

      <div className="grid gap-2.5 md:grid-cols-2">
        <AppSectionBlock
          title="Saúde do caixa"
          subtitle="Risco financeiro imediato."
          className="h-full"
          compact
        >
          <div className="flex h-full flex-col gap-2.5">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/55 p-3 transition-colors hover:border-[var(--border-strong)]">
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]/90">
                Valor em risco
              </p>
              <p className="mt-1 text-3xl font-semibold leading-none text-[var(--text-primary)]">
                {props.risk.riskAmount}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)]/40 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  Hoje
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {props.risk.dueToday}
                </p>
              </div>
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)]/40 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  7 dias
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {props.risk.dueSoon}
                </p>
              </div>
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-base)]/40 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  Vencidas
                </p>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {props.risk.overdueCount}
                </p>
              </div>
            </div>
            <Button
              className="mt-auto w-full"
              variant={isRiskHigh ? "default" : "secondary"}
              onClick={() => props.goToMode("overdue")}
            >
              Ir para vencidas
            </Button>
          </div>
        </AppSectionBlock>

        <AppSectionBlock
          title="Próxima melhor ação"
          subtitle="Decisão recomendada agora."
          className="h-full"
          compact
        >
          <div className="flex h-full flex-col gap-3">
            <p className="text-lg font-semibold leading-tight text-[var(--text-primary)]">
              {nextBestAction.headline}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {nextBestAction.context}
            </p>
            <Button
              className="mt-auto w-full"
              variant="outline"
              onClick={nextBestAction.onClick}
            >
              {nextBestAction.cta}
            </Button>
          </div>
        </AppSectionBlock>
      </div>

      <AppSectionBlock
        title="Fila operacional"
        subtitle="Prioridades para execução direta."
        className="mt-0.5"
        compact
      >
        <div className="space-y-2">
          {props.queueItems.length > 0 ? (
            props.queueItems.map(item => (
              <div
                key={item.id}
                className={cn(
                  "group relative rounded-lg border px-3 py-3 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
                  item.priority === "critical" &&
                    "border-rose-500/35 bg-rose-500/10 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r-md before:bg-rose-400/60",
                  item.priority === "attention" &&
                    "border-amber-500/30 bg-amber-500/7",
                  item.priority === "healthy" &&
                    "border-[var(--border-subtle)] bg-[var(--surface-base)]/50"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {item.client} — {item.value}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      {item.summary}
                    </p>
                    {item.intelligenceLabel ? (
                      <p className="mt-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                        {item.intelligenceLabel}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        item.priority === "critical" &&
                          "border-rose-500/45 bg-rose-500/15 text-rose-200",
                        item.priority === "attention" &&
                          "border-amber-500/45 bg-amber-500/15 text-amber-200",
                        item.priority === "healthy" &&
                          "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                      )}
                    >
                      {item.priority === "critical" ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : item.priority === "attention" ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {item.priority === "critical"
                        ? "Crítica"
                        : item.priority === "attention"
                          ? "Atenção"
                          : "Saudável"}
                    </span>
                    <Button
                      size="sm"
                      variant={
                        item.status === "overdue" ? "default" : "outline"
                      }
                      className="transition-transform duration-200 group-hover:-translate-y-0.5 active:translate-y-0"
                      onClick={item.onAction}
                    >
                      {item.recommendedAction}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              <AppPageEmptyState
                title="Sem itens na fila"
                description="Carteira sob controle. Crie uma cobrança para novo ciclo."
              />
              <div className="flex justify-start">
                <Button size="sm" variant="outline" onClick={props.openCreate}>
                  Criar cobrança
                </Button>
              </div>
            </div>
          )}
        </div>
      </AppSectionBlock>
    </div>
  );
}
