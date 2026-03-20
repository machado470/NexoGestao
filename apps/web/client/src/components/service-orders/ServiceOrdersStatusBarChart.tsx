"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type ServiceOrdersStatusBarChartProps = {
  openCount: number;
  assignedCount: number;
  inProgressCount: number;
  doneCount: number;
  canceledCount: number;
};

const chartConfig = {
  count: {
    label: "Quantidade",
    color: "var(--chart-2)",
  },
  label: {
    color: "var(--background)",
  },
} satisfies ChartConfig;

export default function ServiceOrdersStatusBarChart({
  openCount,
  assignedCount,
  inProgressCount,
  doneCount,
  canceledCount,
}: ServiceOrdersStatusBarChartProps) {
  const chartData = [
    { status: "Abertas", count: Math.max(Number(openCount || 0), 0) },
    { status: "Atribuídas", count: Math.max(Number(assignedCount || 0), 0) },
    { status: "Em andamento", count: Math.max(Number(inProgressCount || 0), 0) },
    { status: "Concluídas", count: Math.max(Number(doneCount || 0), 0) },
    { status: "Canceladas", count: Math.max(Number(canceledCount || 0), 0) },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Status das ordens</CardTitle>
        <CardDescription>
          Ranking rápido por etapa operacional
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{
              right: 20,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="status"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              width={90}
            />
            <XAxis dataKey="count" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Bar dataKey="count" layout="vertical" fill="var(--color-count)" radius={6}>
              <LabelList
                dataKey="count"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
