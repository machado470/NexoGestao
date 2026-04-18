import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type OperationalFlowPoint = {
  day: string;
  orders: number;
  revenue: number;
};

export function OperationalFlowChart({
  data,
  flowView,
}: {
  data: OperationalFlowPoint[];
  flowView: "orders" | "revenue";
}) {
  const strokePrimary = "var(--dashboard-info)";
  const strokeSecondary = "var(--dashboard-warning)";
  const dataKey = flowView === "orders" ? "orders" : "revenue";
  const average =
    data.length > 0
      ? Number(
          (
            data.reduce((acc, item) => acc + Number(item[dataKey]), 0) /
            data.length
          ).toFixed(1)
        )
      : 0;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient
            id={`flowFill-${flowView}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor={strokePrimary}
              stopOpacity={flowView === "orders" ? 0.36 : 0.28}
            />
            <stop offset="100%" stopColor={strokePrimary} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="var(--border-subtle)"
          strokeDasharray="4 4"
          vertical={false}
          opacity={0.36}
        />
        <XAxis
          dataKey="day"
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={34}
        />
        <Tooltip
          cursor={{
            stroke:
              "color-mix(in srgb, var(--dashboard-info) 60%, transparent)",
            strokeWidth: 1,
          }}
          contentStyle={{
            borderRadius: "12px",
            borderColor:
              "color-mix(in srgb, var(--border-subtle) 60%, transparent)",
            background:
              "color-mix(in srgb, var(--surface-elevated) 86%, transparent)",
          }}
          labelStyle={{ color: "var(--text-secondary)", fontSize: "11px" }}
          formatter={(value: number) => [
            `${value}${flowView === "orders" ? "" : "k"}`,
            flowView === "orders" ? "Ordens" : "Receita",
          ]}
        />
        <ReferenceLine
          y={average}
          stroke="color-mix(in srgb, var(--dashboard-warning) 72%, transparent)"
          strokeDasharray="4 4"
          ifOverflow="extendDomain"
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={strokePrimary}
          strokeWidth={2.25}
          fill={`url(#flowFill-${flowView})`}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={strokeSecondary}
          strokeWidth={1.2}
          strokeOpacity={0.65}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
