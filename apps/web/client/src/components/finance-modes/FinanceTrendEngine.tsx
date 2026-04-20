import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts";
import {
  AppPageEmptyState,
  AppSectionBlock,
  appSelectionPillClasses,
} from "@/components/internal-page-system";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export const FINANCE_PERIOD_OPTIONS = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "month", label: "Mês atual" },
] as const;

export type FinanceTrendPeriod = (typeof FINANCE_PERIOD_OPTIONS)[number]["value"];

export interface FinanceTrendPoint {
  key: string;
  label: string;
  revenue: number;
  projected: number;
  overdue: number;
  riskCents: number;
}

interface FinanceTrendEngineProps {
  period: FinanceTrendPeriod;
  onPeriodChange: (period: FinanceTrendPeriod) => void;
  points: FinanceTrendPoint[];
  selectedPointKey: string | null;
  onSelectPoint: (pointKey: string | null) => void;
}

export function FinanceTrendEngine({
  period,
  onPeriodChange,
  points,
  selectedPointKey,
  onSelectPoint,
}: FinanceTrendEngineProps) {
  const criticalPoints = points.filter(item => item.overdue > 0).length;

  return (
    <AppSectionBlock
      title="FinanceTrendEngine"
      subtitle="Receita realizada, prevista e risco por período com foco operacional."
      compact
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FINANCE_PERIOD_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => onPeriodChange(option.value)}
              className={appSelectionPillClasses(period === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {selectedPointKey ? (
          <button
            type="button"
            className={appSelectionPillClasses(false)}
            onClick={() => onSelectPoint(null)}
          >
            Limpar foco do gráfico
          </button>
        ) : null}
      </div>

      {points.length === 0 ? (
        <AppPageEmptyState
          title="Sem tendência no período"
          description="Adicione cobranças e pagamentos para ativar a leitura de tendência."
        />
      ) : (
        <>
          <ChartContainer
            className="h-[270px] w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/30 p-2"
            config={{
              revenue: { label: "Receita realizada", color: "hsl(152 62% 46%)" },
              projected: { label: "Receita prevista", color: "hsl(197 84% 56%)" },
              overdue: { label: "Pontos críticos", color: "hsl(31 92% 55%)" },
            }}
          >
            <ComposedChart data={points} margin={{ top: 10, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="2 5" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis tickLine={false} axisLine={false} width={52} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name, item) => {
                      if (name === "overdue") return [String(value), "Pontos críticos"];
                      const numeric = Number(value ?? 0);
                      const formatted = `R$ ${numeric.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`;
                      return [formatted, name === "revenue" ? "Receita realizada" : "Receita prevista"];
                    }}
                    labelFormatter={(_, payload) => {
                      const point = payload?.[0]?.payload as FinanceTrendPoint | undefined;
                      if (!point) return "";
                      return `${point.label} · Risco ${point.riskCents > 0 ? `R$ ${(point.riskCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "baixo"}`;
                    }}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="projected"
                stroke="var(--color-projected)"
                fill="var(--color-projected)"
                fillOpacity={0.08}
                strokeDasharray="5 6"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: "var(--color-revenue)", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              {points.map(item =>
                item.overdue > 0 ? (
                  <ReferenceDot
                    key={`critical-${item.key}`}
                    x={item.label}
                    y={item.revenue}
                    r={selectedPointKey === item.key ? 6 : 4}
                    fill="var(--color-overdue)"
                    stroke="hsl(var(--background))"
                    strokeWidth={1.5}
                    onClick={() => onSelectPoint(item.key)}
                  />
                ) : null
              )}
            </ComposedChart>
          </ChartContainer>

          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {criticalPoints > 0
              ? `${criticalPoints} pontos críticos no período selecionado.`
              : "Sem pontos críticos no período selecionado."}
          </p>
        </>
      )}
    </AppSectionBlock>
  );
}
