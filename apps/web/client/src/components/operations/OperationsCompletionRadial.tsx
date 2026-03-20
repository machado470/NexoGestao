"use client";

import { CheckCircle2, TrendingUp } from "lucide-react";
import { Label, PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

type OperationsCompletionRadialProps = {
  totalOrders: number;
  completedOrders: number;
  title?: string;
  description?: string;
};

const chartConfig = {
  completion: {
    label: "Conclusão",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export default function OperationsCompletionRadial({
  totalOrders,
  completedOrders,
  title = "Taxa de conclusão",
  description = "Percentual das O.S. concluídas no período",
}: OperationsCompletionRadialProps) {
  const safeTotal = Math.max(Number(totalOrders || 0), 0);
  const safeCompleted = Math.max(Number(completedOrders || 0), 0);
  const percentage =
    safeTotal > 0 ? Math.min(100, Math.round((safeCompleted / safeTotal) * 100)) : 0;

  const chartData = [{ name: "completion", value: percentage, fill: "var(--color-completion)" }];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 items-center justify-center pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-[240px] max-h-[240px]"
        >
          <RadialBarChart
            data={chartData}
            startAngle={90}
            endAngle={90 - (percentage * 3.6)}
            innerRadius={80}
            outerRadius={130}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[86, 74]}
            />
            <RadialBar dataKey="value" background cornerRadius={10} />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;

                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-4xl font-bold"
                      >
                        {percentage}%
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy || 0) + 22}
                        className="fill-muted-foreground text-xs"
                      >
                        concluído
                      </tspan>
                    </text>
                  );
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>

      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 leading-none font-medium">
          {safeCompleted} de {safeTotal} ordens concluídas
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2 leading-none text-muted-foreground">
          Leitura rápida da execução atual <TrendingUp className="h-4 w-4" />
        </div>
      </CardFooter>
    </Card>
  );
}
