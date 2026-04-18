import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppSectionCard } from "@/components/app-system";
import { cn } from "@/lib/utils";

type ExecutiveTrendPeriod =
  | "1d"
  | "7d"
  | "14d"
  | "30d"
  | "60d"
  | "90d"
  | "all";

type ExecutiveTrendMetric = "revenue" | "clients" | "appointments" | "orders";

type ExecutiveTrendPoint = {
  label: string;
  timestamp: string;
  revenue: number;
  clients: number;
  appointments: number;
  orders: number;
};

type ExecutiveTrendDataset = {
  points: ExecutiveTrendPoint[];
  granularityLabel: string;
  comparisonByMetric?: Partial<Record<ExecutiveTrendMetric, number>>;
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
  { value: "60d", label: "60D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "Todo período" },
];

const METRIC_OPTIONS: Array<{
  value: ExecutiveTrendMetric;
  label: string;
  color: string;
  strokeWidth: number;
  showArea: boolean;
  valueFormatter: (value: number) => string;
  summaryLabel: string;
}> = [
  {
    value: "revenue",
    label: "Receita",
    color: "var(--dashboard-info)",
    strokeWidth: 2.4,
    showArea: true,
    valueFormatter: value => formatCurrency(value),
    summaryLabel: "receita",
  },
  {
    value: "clients",
    label: "Clientes",
    color: "var(--color-nexo-purple)",
    strokeWidth: 2,
    showArea: false,
    valueFormatter: value => formatInteger(value),
    summaryLabel: "clientes",
  },
  {
    value: "appointments",
    label: "Agendamentos",
    color: "var(--dashboard-success)",
    strokeWidth: 2,
    showArea: false,
    valueFormatter: value => formatInteger(value),
    summaryLabel: "agendamentos",
  },
  {
    value: "orders",
    label: "Ordens",
    color: "var(--dashboard-warning)",
    strokeWidth: 2,
    showArea: false,
    valueFormatter: value => formatInteger(value),
    summaryLabel: "ordens",
  },
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

function getPointValue(
  point: ExecutiveTrendPoint | undefined,
  metric: ExecutiveTrendMetric
) {
  if (!point) return 0;
  return point[metric];
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
      granularityLabel: string;
      comparisonFactorByMetric: Record<ExecutiveTrendMetric, number>;
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
      granularityLabel: "Granularidade por hora",
      comparisonFactorByMetric: {
        revenue: 0.94,
        clients: 0.93,
        appointments: 0.92,
        orders: 0.91,
      },
    },
    "7d": {
      points: 7,
      stepInHours: 24,
      formatter: date =>
        date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
      granularityLabel: "Granularidade diária",
      comparisonFactorByMetric: {
        revenue: 0.91,
        clients: 0.9,
        appointments: 0.9,
        orders: 0.89,
      },
    },
    "14d": {
      points: 14,
      stepInHours: 24,
      formatter: date =>
        date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
      granularityLabel: "Granularidade diária",
      comparisonFactorByMetric: {
        revenue: 0.92,
        clients: 0.9,
        appointments: 0.91,
        orders: 0.9,
      },
    },
    "30d": {
      points: 30,
      stepInHours: 24,
      formatter: date =>
        date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
      granularityLabel: "Granularidade diária",
      comparisonFactorByMetric: {
        revenue: 0.9,
        clients: 0.89,
        appointments: 0.9,
        orders: 0.89,
      },
    },
    "60d": {
      points: 9,
      stepInHours: 24 * 7,
      formatter: date =>
        date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        }),
      granularityLabel: "Granularidade semanal",
      comparisonFactorByMetric: {
        revenue: 0.9,
        clients: 0.9,
        appointments: 0.89,
        orders: 0.9,
      },
    },
    "90d": {
      points: 13,
      stepInHours: 24 * 7,
      formatter: date =>
        date.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        }),
      granularityLabel: "Granularidade semanal",
      comparisonFactorByMetric: {
        revenue: 0.88,
        clients: 0.89,
        appointments: 0.89,
        orders: 0.88,
      },
    },
    all: {
      points: 12,
      stepInHours: 24 * 30,
      formatter: date =>
        date.toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit",
        }),
      granularityLabel: "Granularidade mensal",
      comparisonFactorByMetric: {
        revenue: 0.87,
        clients: 0.88,
        appointments: 0.88,
        orders: 0.87,
      },
    },
  };

  const config = configByPeriod[period];

  for (let index = 0; index < config.points; index += 1) {
    const pointDate = new Date(
      now.getTime() -
        (config.points - 1 - index) * config.stepInHours * 60 * 60 * 1000
    );

    const seasonality = Math.sin(index / 2.6) * 0.16;
    const trend = index / config.points;
    const weekdayFactor =
      pointDate.getDay() === 0 ? 0.85 : pointDate.getDay() === 6 ? 0.9 : 1;

    const revenue = Math.max(
      Math.round(10200 * (1 + seasonality + trend * 0.2) * weekdayFactor),
      0
    );

    const growth = config.points > 1 ? index / (config.points - 1) : 0;
    const clients = Math.max(
      Math.round(18 + growth * 11 + Math.sin(index / 2.7) * 2.1),
      0
    );
    const appointments = Math.max(
      Math.round(
        35 + growth * 9 + Math.sin(index / 2.3) * 3.8 + Math.cos(index / 3.8) * 2
      ),
      0
    );
    const orders = Math.max(
      Math.round(26 + growth * 6.5 + Math.sin(index / 1.9) * 2.7),
      0
    );

    points.push({
      label: config.formatter(pointDate),
      timestamp: pointDate.toISOString(),
      revenue,
      clients,
      appointments,
      orders,
    });
  }

  const totalsByMetric: Record<ExecutiveTrendMetric, number> = {
    revenue: points.reduce((acc, point) => acc + point.revenue, 0),
    clients: points.reduce((acc, point) => acc + point.clients, 0),
    appointments: points.reduce((acc, point) => acc + point.appointments, 0),
    orders: points.reduce((acc, point) => acc + point.orders, 0),
  };

  const comparisonByMetric: Record<ExecutiveTrendMetric, number> = {
    revenue: Math.round(
      totalsByMetric.revenue * config.comparisonFactorByMetric.revenue
    ),
    clients: Math.round(
      totalsByMetric.clients * config.comparisonFactorByMetric.clients
    ),
    appointments: Math.round(
      totalsByMetric.appointments * config.comparisonFactorByMetric.appointments
    ),
    orders: Math.round(totalsByMetric.orders * config.comparisonFactorByMetric.orders),
  };

  return {
    points,
    granularityLabel: config.granularityLabel,
    comparisonByMetric,
  };
}

function getPeriodNarrative(
  metricLabel: string,
  period: ExecutiveTrendPeriod,
  granularityLabel: string
) {
  const option = PERIOD_OPTIONS.find(item => item.value === period);
  return `${metricLabel} · ${option?.label ?? "Período"} selecionado · ${granularityLabel.toLowerCase()}.`;
}

function buildFallbackPointsForMetric(
  metric: ExecutiveTrendMetric,
  period: ExecutiveTrendPeriod
) {
  const fallback = buildMockTrendDataset(period).points;
  if (metric === "revenue") return fallback;

  return fallback.map((point, index) => {
    if (metric === "clients") {
      return {
        ...point,
        clients: Math.max(Math.round(20 + index * 1.1 + Math.sin(index / 2.8) * 2), 1),
      };
    }
    if (metric === "appointments") {
      return {
        ...point,
        appointments: Math.max(
          Math.round(39 + index * 1.2 + Math.sin(index / 2.2) * 4),
          1
        ),
      };
    }
    return {
      ...point,
      orders: Math.max(Math.round(29 + index * 0.7 + Math.cos(index / 2.4) * 3), 1),
    };
  });
}

function getYAxisDomain(
  metric: ExecutiveTrendMetric,
  values: number[]
): [number, number] {
  if (!values.length) return [0, 1];

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  if (minValue === maxValue) {
    const offset = metric === "revenue" ? Math.max(400, minValue * 0.12) : 3;
    return [Math.max(0, Math.floor(minValue - offset)), Math.ceil(maxValue + offset)];
  }

  const span = maxValue - minValue;
  const padding = metric === "revenue" ? Math.max(span * 0.2, 500) : Math.max(span * 0.24, 2);
  const lowerBound = Math.max(0, Math.floor(minValue - padding));
  const upperBound = Math.ceil(maxValue + padding);
  return [lowerBound, upperBound];
}

export function ExecutiveTrendChart({
  className,
  dataByPeriod,
}: ExecutiveTrendChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<ExecutiveTrendMetric>(
    "revenue"
  );
  const [selectedPeriod, setSelectedPeriod] =
    useState<ExecutiveTrendPeriod>("30d");

  const dataset = useMemo(() => {
    const customData = dataByPeriod?.[selectedPeriod];
    if (customData) return customData;
    return buildMockTrendDataset(selectedPeriod);
  }, [dataByPeriod, selectedPeriod]);

  const selectedMetricOption =
    METRIC_OPTIONS.find(metric => metric.value === selectedMetric) ??
    METRIC_OPTIONS[0];

  const safeChartData = useMemo(() => {
    const candidatePoints = dataset.points.filter(point =>
      Number.isFinite(getPointValue(point, selectedMetric))
    );
    if (candidatePoints.length >= 2) return candidatePoints;
    return buildFallbackPointsForMetric(selectedMetric, selectedPeriod);
  }, [dataset.points, selectedMetric, selectedPeriod]);

  const metricValues = safeChartData.map(point => getPointValue(point, selectedMetric));
  const yAxisDomain = getYAxisDomain(selectedMetric, metricValues);

  const totalValue = safeChartData.reduce(
    (acc, item) => acc + getPointValue(item, selectedMetric),
    0
  );

  const comparisonValue = dataset.comparisonByMetric?.[selectedMetric] ?? 0;
  const deltaPercent =
    comparisonValue > 0 ? ((totalValue - comparisonValue) / comparisonValue) * 100 : 0;

  const sortedPoints = [...safeChartData].sort(
    (a, b) => getPointValue(a, selectedMetric) - getPointValue(b, selectedMetric)
  );
  const worstPoint = sortedPoints[0];
  const bestPoint = sortedPoints[sortedPoints.length - 1];

  const formatSummaryValue = (value: number) => {
    if (selectedMetric === "revenue") return formatCurrency(value);
    return formatInteger(value);
  };

  return (
    <AppSectionCard className={cn("p-5 md:p-6", className)}>
      <div className="mb-5 flex flex-col gap-4 md:mb-6 md:gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)] md:text-lg">
              Visão operacional
            </h3>
            <p className="mt-1 text-xs text-[var(--text-muted)] md:text-sm">
              {getPeriodNarrative(
                selectedMetricOption.label,
                selectedPeriod,
                dataset.granularityLabel
              )}
            </p>
          </div>

          <div
            className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:w-auto md:justify-end"
            role="tablist"
            aria-label="Seleção de período do gráfico"
          >
            {PERIOD_OPTIONS.map(option => {
              const isActive = option.value === selectedPeriod;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSelectedPeriod(option.value)}
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

        <div
          className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 pb-1"
          role="tablist"
          aria-label="Seleção de métrica do gráfico"
        >
          {METRIC_OPTIONS.map(option => {
            const isActive = option.value === selectedMetric;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedMetric(option.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  "focus-visible:ring-[var(--dashboard-info)]",
                  "focus-visible:ring-offset-[var(--nexo-card-surface)]",
                  isActive
                    ? "text-[var(--text-primary)]"
                    : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--dashboard-row-border)] hover:bg-[var(--dashboard-row-hover)] hover:text-[var(--text-primary)]"
                )}
                style={
                  isActive
                    ? {
                        borderColor: option.color,
                        backgroundColor: "var(--dashboard-row-bg)",
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${option.color} 24%, transparent)`,
                      }
                    : undefined
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[320px] w-full md:h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          {selectedMetricOption.showArea ? (
            <AreaChart
              data={safeChartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 6 }}
            >
              <defs>
                <linearGradient
                  id="executive-metric-gradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={selectedMetricOption.color}
                    stopOpacity={0.28}
                  />
                  <stop
                    offset="95%"
                    stopColor={selectedMetricOption.color}
                    stopOpacity={0.03}
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
                tickLine={false}
                axisLine={false}
                width={selectedMetric === "revenue" ? 78 : 46}
                domain={yAxisDomain}
                tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                tickFormatter={value =>
                  selectedMetric === "revenue"
                    ? formatCompactCurrency(Number(value))
                    : formatInteger(Number(value))
                }
              />
              <Tooltip
                contentStyle={{
                  background: "var(--nexo-card-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "12px",
                  boxShadow: "var(--shadow-sm)",
                }}
                labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
                formatter={(value: number) =>
                  selectedMetric === "revenue"
                    ? formatCurrency(Number(value))
                    : formatInteger(Number(value))
                }
              />

              <Area
                type="monotone"
                dataKey={selectedMetric}
                name={selectedMetricOption.label}
                stroke={selectedMetricOption.color}
                strokeWidth={selectedMetricOption.strokeWidth}
                fill="url(#executive-metric-gradient)"
                fillOpacity={1}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          ) : (
            <LineChart
              data={safeChartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 6 }}
            >
            <defs>
              <linearGradient
                id="executive-metric-gradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={selectedMetricOption.color}
                  stopOpacity={0.28}
                />
                <stop
                  offset="95%"
                  stopColor={selectedMetricOption.color}
                  stopOpacity={0.03}
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
              tickLine={false}
              axisLine={false}
              width={selectedMetric === "revenue" ? 78 : 46}
              domain={yAxisDomain}
              tick={{ fill: "var(--text-muted)", fontSize: 12 }}
              tickFormatter={value =>
                selectedMetric === "revenue"
                  ? formatCompactCurrency(Number(value))
                  : formatInteger(Number(value))
              }
            />
            <Tooltip
              contentStyle={{
                background: "var(--nexo-card-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                boxShadow: "var(--shadow-sm)",
              }}
              labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
              formatter={(value: number) =>
                selectedMetric === "revenue"
                  ? formatCurrency(Number(value))
                  : formatInteger(Number(value))
              }
            />
            <Line
              type="monotone"
              dataKey={selectedMetric}
              name={selectedMetricOption.label}
              stroke={selectedMetricOption.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            </LineChart>
          )}
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
              deltaPercent >= 0
                ? "text-[var(--dashboard-success)]"
                : "text-[var(--dashboard-danger)]"
            )}
          >
            {`${deltaPercent >= 0 ? "+" : ""}${deltaPercent.toFixed(1).replace(".", ",")}%`}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Volume total
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
            {selectedMetric === "revenue"
              ? formatCurrency(totalValue)
              : `${formatInteger(totalValue)} ${selectedMetricOption.summaryLabel}`}
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Melhor e pior janela
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
            {`Melhor: ${bestPoint?.label ?? "-"} · ${formatSummaryValue(getPointValue(bestPoint, selectedMetric))}`}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {`Pior: ${worstPoint?.label ?? "-"} · ${formatSummaryValue(getPointValue(worstPoint, selectedMetric))}`}
          </p>
        </div>
      </div>
    </AppSectionCard>
  );
}

export type {
  ExecutiveTrendDataset,
  ExecutiveTrendMetric,
  ExecutiveTrendPeriod,
  ExecutiveTrendPoint,
};
