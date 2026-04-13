"use client";

import { useEffect, useMemo } from "react";
import { Activity } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { safeChartData } from "@/lib/safeChartData";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";

type OperationsFlowAreaChartProps = {
  openOrders: number;
  assignedOrders: number;
  inProgressOrders: number;
  completedOrders: number;
};

const chartConfig = {
  quantity: {
    label: "Quantidade",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export default function OperationsFlowAreaChart({
  openOrders,
  assignedOrders,
  inProgressOrders,
  completedOrders,
}: OperationsFlowAreaChartProps) {
  useRenderWatchdog("OperationsFlowAreaChart");
  const chartData = [
    { stage: "Abertas", quantity: Math.max(Number(openOrders || 0), 0) },
    { stage: "Atribuídas", quantity: Math.max(Number(assignedOrders || 0), 0) },
    { stage: "Em execução", quantity: Math.max(Number(inProgressOrders || 0), 0) },
    { stage: "Concluídas", quantity: Math.max(Number(completedOrders || 0), 0) },
  ];
  const safeData = useMemo(
    () => safeChartData<{ stage: string; quantity: number }>(chartData, ["quantity"]),
    [chartData]
  );
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[CHART DATA] operations.flow", safeData);
  }, [safeData]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Fluxo operacional</CardTitle>
        <CardDescription>
          Distribuição das O.S. ao longo das etapas do ciclo atual
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!safeData.isValid ? (
          <p className="text-sm text-[var(--text-muted)]">Erro ao renderizar gráfico.</p>
        ) : (
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart
            accessibilityLayer
            data={safeData.data}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="stage"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <defs>
              <linearGradient id="fillQuantity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-quantity)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-quantity)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <Area
              dataKey="quantity"
              type="natural"
              fill="url(#fillQuantity)"
              fillOpacity={0.4}
              stroke="var(--color-quantity)"
              strokeWidth={2}
            />
          </AreaChart>
          </ChartContainer>
        )}
      </CardContent>

      <CardFooter>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          Visão resumida da pressão operacional do período
        </div>
      </CardFooter>
    </Card>
  );
}
