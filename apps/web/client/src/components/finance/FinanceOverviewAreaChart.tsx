"use client";

import { Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type FinanceOverviewAreaChartProps = {
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
};

const chartConfig = {
  amount: {
    label: "Valor",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

export default function FinanceOverviewAreaChart({
  paidAmount,
  pendingAmount,
  overdueAmount,
}: FinanceOverviewAreaChartProps) {
  const chartData = [
    { stage: "Recebido", amount: Math.max(Number(paidAmount || 0), 0) },
    { stage: "Pendente", amount: Math.max(Number(pendingAmount || 0), 0) },
    { stage: "Vencido", amount: Math.max(Number(overdueAmount || 0), 0) },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Leitura financeira</CardTitle>
        <CardDescription>
          Comparativo entre recebido, pendente e vencido
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
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
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value) => (
                    <span className="text-foreground font-mono font-medium tabular-nums">
                      {formatMoney(Number(value || 0))}
                    </span>
                  )}
                />
              }
            />
            <defs>
              <linearGradient id="fillAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-amount)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-amount)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <Area
              dataKey="amount"
              type="natural"
              fill="url(#fillAmount)"
              fillOpacity={0.4}
              stroke="var(--color-amount)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>

      <CardFooter>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4" />
          Dinheiro visível sem depender de adivinhação
        </div>
      </CardFooter>
    </Card>
  );
}
