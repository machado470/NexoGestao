import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  dueDate: string;
  status: "overdue" | "pending" | "ready";
  priority: "critical" | "attention" | "healthy";
  recommendedAction: "Cobrar" | "Lembrar" | "Registrar pagamento";
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
  statusDistribution: Array<{
    label: string;
    key: "pending" | "overdue" | "paid";
    value: number;
    total: string;
  }>;
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
  const isRiskHigh = props.risk.overdueCount > 0 || props.risk.dueToday > 0;

  return (
    <div className="space-y-3">
      <AppKpiRow items={props.kpis} />

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <AppChartPanel
            title="Receita e previsão"
            description="Recebido, previsto e vencimentos no período."
          >
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
                className="h-[250px] w-full"
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
                  margin={{ top: 8, right: 8, bottom: 0, left: -10 }}
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
                    minTickGap={24}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={42}
                    tick={{ fontSize: 11 }}
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
                              : `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
                                  {Number(
                                    (item as any)?.payload?.projected ?? 0
                                  )}
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
                    fillOpacity={0.16}
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
                  <Bar
                    dataKey="overdue"
                    barSize={7}
                    radius={[8, 8, 0, 0]}
                    fill="var(--color-overdue)"
                    fillOpacity={0.5}
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

          <AppChartPanel
            title="Distribuição por status"
            description="Clique para abrir o modo correspondente."
          >
            <ChartContainer
              className="h-[205px] w-full"
              config={{ value: { label: "Cobranças" } }}
            >
              <BarChart
                data={props.statusDistribution}
                margin={{ left: -16, right: 4, top: 4, bottom: 0 }}
                barCategoryGap={18}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="2 4"
                  stroke="color-mix(in srgb, var(--border-subtle) 45%, transparent)"
                />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={30} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      className="border-[var(--border-subtle)] bg-[var(--surface-elevated)]/95"
                      formatter={(value, _name, item) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <div className="text-muted-foreground">
                            {String((item as any)?.payload?.label ?? "Status")}
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              {Number(value)} cobranças
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {String((item as any)?.payload?.total ?? "-")}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {String((item as any)?.payload?.key) === "pending"
                                ? "Abrir pendentes"
                                : String((item as any)?.payload?.key) ===
                                    "overdue"
                                  ? "Abrir vencidas"
                                  : "Abrir pagas"}
                            </div>
                          </div>
                        </div>
                      )}
                    />
                  }
                />
                <Bar
                  dataKey="value"
                  radius={[8, 8, 0, 0]}
                  onClick={entry => props.goToMode(entry.key)}
                  className="cursor-pointer"
                >
                  {props.statusDistribution.map(entry => (
                    <Cell
                      key={entry.key}
                      fill={
                        entry.key === "pending"
                          ? "hsl(214 80% 63%)"
                          : entry.key === "overdue"
                            ? "hsl(6 82% 64%)"
                            : "hsl(151 56% 46%)"
                      }
                      fillOpacity={entry.key === "overdue" ? 0.82 : 0.72}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </AppChartPanel>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <AppSectionBlock
            title="Saúde do caixa"
            subtitle="Risco financeiro imediato."
            compact
          >
            <div className="space-y-2.5">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/55 p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  Valor em risco
                </p>
                <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">
                  {props.risk.riskAmount}
                </p>
              </div>
              <ul className="space-y-1.5 text-sm text-[var(--text-secondary)]">
                <li>{props.risk.overdueCount} vencida(s) precisam de ação</li>
                <li>
                  {props.risk.dueToday} hoje · {props.risk.dueSoon} nos próximos
                  7 dias
                </li>
              </ul>
              <Button
                className="w-full"
                variant={isRiskHigh ? "default" : "secondary"}
                onClick={() => props.goToMode("overdue")}
              >
                Ir para vencidas
              </Button>
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Próxima melhor ação"
            subtitle="Ação operacional da semana."
            compact
          >
            <div className="space-y-2.5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Cobrar hoje
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {props.risk.overdueCount + props.risk.dueToday} item(ns) exigem
                ação imediata.
              </p>
              <Button
                className="w-full"
                variant="outline"
                onClick={props.cobrarAgora}
              >
                Cobrar agora
              </Button>
            </div>
          </AppSectionBlock>
        </div>
      </div>

      <AppSectionBlock
        title="Fila operacional"
        subtitle="Prioridades para execução direta."
        compact
      >
        <div className="space-y-2">
          {props.queueItems.length > 0 ? (
            props.queueItems.map(item => (
              <div
                key={item.id}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {item.client} · {item.value}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      Vencimento {item.dueDate} ·{" "}
                      {item.status === "overdue"
                        ? "Vencida"
                        : item.status === "pending"
                          ? "Pendente"
                          : "Pronta para baixa"}
                    </p>
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
