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
    <div className="space-y-4">
      <AppKpiRow items={props.kpis} />

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-4">
          <AppChartPanel
            title="Receita e previsão"
            description="Evolução real do caixa com entradas previstas e pontos de risco."
          >
            <div className="mb-3 flex flex-wrap gap-1.5">
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
                className="h-[320px] w-full"
                config={{
                  revenue: { label: "Recebido", color: "hsl(var(--accent))" },
                  projected: {
                    label: "Previsto",
                    color: "hsl(var(--primary))",
                  },
                  overdue: {
                    label: "Vencidas",
                    color: "hsl(var(--destructive))",
                  },
                }}
              >
                <ComposedChart
                  data={data}
                  margin={{ top: 12, right: 12, bottom: 0, left: -8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="color-mix(in srgb, var(--border-subtle) 70%, transparent)"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis tickLine={false} axisLine={false} width={48} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={value => `Período: ${String(value)}`}
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
                            <div className="flex w-full items-center justify-between gap-3">
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
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-revenue)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                  <Bar
                    dataKey="overdue"
                    barSize={8}
                    radius={[8, 8, 0, 0]}
                    fill="var(--color-overdue)"
                    fillOpacity={0.45}
                  />
                </ComposedChart>
              </ChartContainer>
            )}

            <div className="mt-3 text-xs text-[var(--text-muted)]">
              {totalOverdueEvents > 0
                ? `${totalOverdueEvents} pontos de vencimento no período selecionado.`
                : "Sem eventos de vencimento no período selecionado."}
            </div>
          </AppChartPanel>

          <AppChartPanel
            title="Distribuição por status"
            description="Clique nas barras para navegar no modo da carteira."
          >
            <ChartContainer
              className="h-[260px] w-full"
              config={{ value: { label: "Cobranças" } }}
            >
              <BarChart
                data={props.statusDistribution}
                margin={{ left: -12, right: 6, top: 8 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={32} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
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
                          ? "hsl(var(--accent))"
                          : entry.key === "overdue"
                            ? "hsl(var(--destructive))"
                            : "hsl(151 65% 43%)"
                      }
                      fillOpacity={entry.key === "overdue" ? 0.75 : 0.6}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </AppChartPanel>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <AppSectionBlock
            title="Saúde do caixa"
            subtitle="Leitura rápida de risco e priorização imediata."
          >
            <div className="space-y-3">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/60 p-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Valor em risco imediato
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                  {props.risk.riskAmount}
                </p>
              </div>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                <li>
                  {props.risk.overdueCount} cobrança(s) vencida(s) exige(m) ação
                  hoje
                </li>
                <li>
                  {props.risk.dueToday} vencendo hoje · {props.risk.dueSoon} nos
                  próximos 7 dias
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
            subtitle="Conduza o caixa para o cenário saudável."
          >
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Priorize cobranças com vencimento hoje e esta semana.
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
        subtitle="Prioridades do dia para execução direta."
      >
        <div className="space-y-2.5">
          {props.queueItems.length > 0 ? (
            props.queueItems.map(item => (
              <div
                key={item.id}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/65 px-3.5 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {item.client} · {item.value}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
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
                        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium",
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
