import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type OperationalRadialMetricProps = {
  value: number;
  label: string;
  color?: string;
  size?: number;
  thickness?: number;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
};

const chartConfig = {
  value: {
    label: "Percentual",
    color: "var(--dashboard-info)",
  },
} satisfies ChartConfig;

export function OperationalRadialMetric({
  value,
  label,
  color = "var(--dashboard-info)",
  size = 88,
  thickness = 10,
  className,
  valueClassName,
  labelClassName,
}: OperationalRadialMetricProps) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const innerRadius = Math.max(10, Math.floor(size / 2 - thickness - 5));
  const outerRadius = Math.max(innerRadius + 4, Math.floor(size / 2 - 5));

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <ChartContainer
          config={chartConfig}
          className="aspect-square"
          style={{
            width: size,
            height: size,
            ["--color-value" as string]: color,
          }}
        >
          <RadialBarChart
            data={[{ value: safeValue }]}
            startAngle={90}
            endAngle={-270}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            barSize={thickness}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={thickness / 2}
              fill="var(--color-value)"
              background={{
                fill: "color-mix(in srgb, var(--dashboard-neutral) 34%, transparent)",
              }}
            />
          </RadialBarChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "text-sm font-semibold tabular-nums text-[var(--text-primary)]",
              valueClassName
            )}
          >
            {safeValue}%
          </span>
        </div>
      </div>
      <span
        className={cn(
          "text-[11px] font-medium text-[var(--text-secondary)]",
          labelClassName
        )}
      >
        {label}
      </span>
    </div>
  );
}
