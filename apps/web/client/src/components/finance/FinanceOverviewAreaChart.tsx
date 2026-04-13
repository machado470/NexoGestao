"use client";

import { useEffect, useMemo } from "react";
import { Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { EmptyState } from "@/components/EmptyState";
import { safeChartData } from "@/lib/safeChartData";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { setBootPhase } from "@/lib/bootPhase";

type FinanceTimelinePoint = {
  day: string;
  paid: number;
  pending: number;
  overdue: number;
};

type FinanceOverviewAreaChartProps = {
  timeline: FinanceTimelinePoint[];
};

const chartConfig = {
  paid: {
    label: "Recebido",
    color: "#22c55e",
  },
  pending: {
    label: "Pendente",
    color: "#3b82f6",
  },
  overdue: {
    label: "Vencido",
    color: "#ef4444",
  },
} satisfies ChartConfig;

function formatMoneyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0) / 100);
}

export default function FinanceOverviewAreaChart({ timeline }: FinanceOverviewAreaChartProps) {
  setBootPhase("CHART:FinanceOverviewAreaChart");
  useRenderWatchdog("FinanceOverviewAreaChart");
  const safeTimeline = useMemo(
    () => safeChartData<FinanceTimelinePoint>(timeline, ["paid", "pending", "overdue"]),
    [timeline]
  );
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[CHART DATA] finances.timeline", safeTimeline);
  }, [safeTimeline]);
  const hasTimeline = safeTimeline.data.some(
    (point) => Number(point.paid) > 0 || Number(point.pending) > 0 || Number(point.overdue) > 0
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Leitura financeira temporal</CardTitle>
        <CardDescription>Recebido vs pendente vs vencido por dia</CardDescription>
      </CardHeader>

      <CardContent>
        {!safeTimeline.isValid ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Erro ao renderizar gráfico"
            description={safeTimeline.reason ?? "Dados inválidos para o gráfico."}
          />
        ) : hasTimeline ? (
          <ChartContainer config={chartConfig} className="h-[260px] w-full">
            <AreaChart accessibilityLayer data={safeTimeline.data} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickFormatter={(value) => formatMoneyFromCents(Number(value))} width={92} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <span className="text-foreground font-mono font-medium tabular-nums">
                        {formatMoneyFromCents(Number(value || 0))}
                      </span>
                    )}
                  />
                }
              />
              <Area dataKey="paid" type="monotone" fill="var(--color-paid)" fillOpacity={0.18} stroke="var(--color-paid)" strokeWidth={2} />
              <Area dataKey="pending" type="monotone" fill="var(--color-pending)" fillOpacity={0.16} stroke="var(--color-pending)" strokeWidth={2} />
              <Area dataKey="overdue" type="monotone" fill="var(--color-overdue)" fillOpacity={0.14} stroke="var(--color-overdue)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        ) : (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Sem histórico financeiro ainda"
            description="Quando houver cobranças e pagamentos, este gráfico mostrará tendência de caixa com recebido, pendente e vencido."
          />
        )}
      </CardContent>

      <CardFooter>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4" />
          Série diária para priorizar cobrança
        </div>
      </CardFooter>
    </Card>
  );
}
