import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
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
  const strokeSecondary = "var(--dashboard-info-soft)";
  const dataKey = flowView === "orders" ? "orders" : "revenue";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="flowFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={strokePrimary}
              stopOpacity={flowView === "orders" ? 0.34 : 0.24}
            />
            <stop offset="100%" stopColor={strokePrimary} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="var(--border-subtle)"
          strokeDasharray="3 3"
          vertical={false}
          opacity={0.28}
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
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={strokePrimary}
          strokeWidth={2.25}
          fill="url(#flowFill)"
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={strokeSecondary}
          strokeWidth={1.3}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
