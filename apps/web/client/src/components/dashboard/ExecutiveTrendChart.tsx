import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppSectionCard } from "@/components/app-system";
import { cn } from "@/lib/utils";

type ExecutiveTrendPeriod = "1d" | "7d" | "14d" | "30d" | "all";

type ExecutiveTrendPoint = {
  label: string;
  timestamp: string;
  revenue: number;
  completedOrders: number;
  generatedCharges: number;
  receivedPayments: number;
};

type ExecutiveTrendDataset = {
  points: ExecutiveTrendPoint[];
  comparisonRevenue: number;
  granularityLabel: string;
};

type ExecutiveTrendChartProps = {
  className?: string;
  dataByPeriod?: Partial<Record<ExecutiveTrendPeriod, ExecutiveTrendDataset>>;
};

const PERIOD_OPTIONS: Array<{ value: ExecutiveTrendPeriod; label: string }> = [
  { value: "1d", label: "1D" },
  { value: "7d", label: "7D" },
  { value: "14d", label: "14D" },
  { value: "30d", label: "30D" },
  { value: "all", label: "Todo período" },
];

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function buildMockTrendDataset(
  period: ExecutiveTrendPeriod
): ExecutiveTrendDataset {
  const now = new Date();
  const points: ExecutiveTrendPoint[] = [];

  const configByPeriod: Record<
    ExecutiveTrendPeriod,
    {
      points: number;
      stepInHours: number;
      formatter: (date: Date) => string;
      baseRevenue: number;
      cycle: number;
      granularityLabel: string;
      comparisonFactor: number;
    }
  > = {
    "1d": {
      points: 24,
      stepInHours: 1,
      formatter: date =>
        date.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      baseRevenue: 6400,
      cycle: 6,
      granularityLabel: "Granularidade por hora",
      comparisonFactor: 0.94,
    },
    "7d": {
      points: 7,
      stepInHours: 24,
      formatter: date =>
        date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
      baseRevenue: 14800,
      cycle: 2.4,
      granularityLabel: "Granularidade diária",
      comparisonFactor: 0.91,
    },
    "14d": {
      points: 14,
      stepInHours: 24,
      formatter: date =>
        date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
      baseRevenue: 13200,
      cycle: 3.1,
      granularityLabel: "Granularidade diária",
      comparisonFactor: 0.92,
    },
    "30d": {
      points: 30,
      stepInHours: 24,
      formatter: date =>
        date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
      baseRevenue: 12100,
      cycle: 5.2,
      granularityLabel: "Granularidade diária",
      comparisonFactor: 0.9,
    },
    all: {
      points: 24,
      stepInHours: 24 * 7,
      formatter: date =>
        date.toLocaleDateString("pt-BR", {
          month: "short",
          day: "2-digit",
        }),
      baseRevenue: 18900,
      cycle: 4.4,
      granularityLabel: "Granularidade semanal",
      comparisonFactor: 0.88,
    },
  };

  const config = configByPeriod[period];

  for (let index = 0; index < config.points; index += 1) {
    const pointDate = new Date(
      now.getTime() -
        (config.points - 1 - index) * config.stepInHours * 60 * 60 * 1000
    );

    const seasonality = Math.sin(index / config.cycle) * 0.17;
    const trend = index / config.points;
    const weekdayFactor =
      pointDate.getDay() === 0 ? 0.87 : pointDate.getDay() === 6 ? 0.91 : 1;

    const revenue = Math.max(
      Math.round(
        config.baseRevenue * (1 + seasonality + trend * 0.15) * weekdayFactor
      ),
      0
    );

    const completedOrders = Math.max(Math.round(revenue / 164), 0);
    const generatedCharges = Math.max(Math.round(completedOrders * 1.05), 0);
    const receivedPayments = Math.max(Math.round(revenue * 0.92), 0);

    points.push({
      label: config.formatter(pointDate),
      timestamp: pointDate.toISOString(),
      revenue,
      completedOrders,
      generatedCharges,
      receivedPayments,
    });
  }

  const totalRevenue = points.reduce((acc, point) => acc + point.revenue, 0);

  return {
    points,
    granularityLabel: config.granularityLabel,
    comparisonRevenue: Math.round(totalRevenue * config.comparisonFactor),
  };
}

function getPeriodNarrative(
  period: ExecutiveTrendPeriod,
  granularityLabel: string
) {
  const option = PERIOD_OPTIONS.find(item => item.value === period);
  return `${option?.label ?? "Período"} selecionado · ${granularityLabel.toLowerCase()}.`;
}

export function ExecutiveTrendChart({
  className,
  dataByPeriod,
}: ExecutiveTrendChartProps) {
  const [period, setPeriod] = useState<ExecutiveTrendPeriod>("30d");

  const dataset = useMemo(() => {
    const customData = dataByPeriod?.[period];
    if (customData) return customData;
    return buildMockTrendDataset(period);
  }, [dataByPeriod, period]);

  const totalRevenue = dataset.points.reduce(
    (acc, item) => acc + item.revenue,
    0
  );
  const totalOrders = dataset.points.reduce(
    (acc, item) => acc + item.completedOrders,
    0
  );
  const totalPayments = dataset.points.reduce(
    (acc, item) => acc + item.receivedPayments,
    0
  );

  const revenueDeltaPercent =
    dataset.comparisonRevenue > 0
      ? ((totalRevenue - dataset.comparisonRevenue) /
          dataset.comparisonRevenue) *
        100
      : 0;

  const sortedByRevenue = [...dataset.points].sort(
    (a, b) => a.revenue - b.revenue
  );
  const worstPoint = sortedByRevenue[0];
  const bestPoint = sortedByRevenue[sortedByRevenue.length - 1];

  return (
    <AppSectionCard className={cn("p-5 md:p-6", className)}>
      <div className="mb-5 flex flex-col gap-4 md:mb-6 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] md:text-lg">
            Visão operacional
          </h3>
          <p className="mt-1 text-xs text-[var(--text-muted)] md:text-sm">
            {getPeriodNarrative(period, dataset.granularityLabel)}
          </p>
        </div>

        <div
          className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:w-auto md:justify-end"
          role="tablist"
          aria-label="Seleção de período do gráfico"
        >
          {PERIOD_OPTIONS.map(option => {
            const isActive = option.value === period;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setPeriod(option.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dashboard-info)] focus-visible:ring-offset-2",
                  "focus-visible:ring-offset-[var(--nexo-card-surface)]",
                  isActive
                    ? "border-[var(--dashboard-info)] bg-[var(--dashboard-row-bg)] text-[var(--text-primary)]"
                    : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--dashboard-row-border)] hover:bg-[var(--dashboard-row-hover)] hover:text-[var(--text-primary)]"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[320px] w-full md:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={dataset.points}
            margin={{ top: 8, right: 12, left: 0, bottom: 6 }}
          >
            <defs>
              <linearGradient
                id="executive-revenue-gradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--dashboard-info)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--dashboard-info)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--border-subtle)"
              vertical={false}
              opacity={0.45}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            />
            <YAxis
              yAxisId="currency"
              tickLine={false}
              axisLine={false}
              width={70}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={value => formatCompactCurrency(Number(value))}
            />
            <YAxis yAxisId="ops" hide domain={[0, "auto"]} />
            <Tooltip
              contentStyle={{
                background: "var(--nexo-card-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                boxShadow: "var(--shadow-sm)",
              }}
              labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
              formatter={(value: number, name: string) => {
                if (name === "Receita operacional")
                  return formatCurrency(Number(value));
                return formatInteger(Number(value));
              }}
            />
            <Legend
              verticalAlign="top"
              wrapperStyle={{
                paddingBottom: 14,
                color: "var(--text-secondary)",
                fontSize: "12px",
              }}
            />

            <Area
              yAxisId="currency"
              type="monotone"
              dataKey="revenue"
              name="Receita operacional"
              stroke="var(--dashboard-info)"
              strokeWidth={2.2}
              fill="url(#executive-revenue-gradient)"
              fillOpacity={1}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="ops"
              type="monotone"
              dataKey="receivedPayments"
              name="Pagamentos recebidos"
              stroke="var(--dashboard-success)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="ops"
              type="monotone"
              dataKey="completedOrders"
              name="Ordens concluídas"
              stroke="var(--dashboard-warning)"
              strokeWidth={1.8}
              strokeDasharray="5 4"
              dot={false}
            />
            <Line
              yAxisId="ops"
              type="monotone"
              dataKey="generatedCharges"
              name="Cobranças geradas"
              stroke="var(--text-muted)"
              strokeWidth={1.6}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-[var(--border-subtle)] pt-4 md:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Variação do período
          </p>
          <p
            className={cn(
              "mt-1 text-sm font-semibold",
              revenueDeltaPercent >= 0
                ? "text-[var(--dashboard-success)]"
                : "text-[var(--dashboard-danger)]"
            )}
          >
            {`${revenueDeltaPercent >= 0 ? "+" : ""}${revenueDeltaPercent.toFixed(1).replace(".", ",")}%`}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Volume total
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
            {`${formatCurrency(totalRevenue)} · ${formatInteger(totalOrders)} ordens · ${formatCurrency(totalPayments)} recebidos`}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Melhor e pior janela
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
            {`Melhor: ${bestPoint.label} · ${formatCurrency(bestPoint.revenue)}`}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {`Pior: ${worstPoint.label} · ${formatCurrency(worstPoint.revenue)}`}
          </p>
        </div>
      </div>
    </AppSectionCard>
  );
}

export type {
  ExecutiveTrendDataset,
  ExecutiveTrendPeriod,
  ExecutiveTrendPoint,
};
