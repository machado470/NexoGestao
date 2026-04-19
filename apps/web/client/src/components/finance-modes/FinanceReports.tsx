import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  AppChartPanel,
  AppPageEmptyState,
  AppSectionBlock,
} from "@/components/internal-page-system";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface FinanceReportsProps {
  revenueData: Array<{ label: string; revenue: number }>;
  statusDistribution: Array<{ label: string; value: number }>;
  overdueTotal: string;
  openTotal: string;
  receivedTotal: string;
}

export function FinanceReports({
  revenueData,
  statusDistribution,
  overdueTotal,
  openTotal,
  receivedTotal,
}: FinanceReportsProps) {
  const totalCharges = statusDistribution.reduce(
    (acc, item) => acc + item.value,
    0
  );
  const overdueCount =
    statusDistribution.find(item => item.label.toLowerCase().includes("venc"))
      ?.value ?? 0;
  const paidCount =
    statusDistribution.find(item => item.label.toLowerCase().includes("pag"))
      ?.value ?? 0;
  const defaultTicket = revenueData.length
    ? revenueData.reduce((acc, item) => acc + item.revenue, 0) /
      revenueData.length
    : 0;
  const delinquencyRate =
    totalCharges > 0 ? (overdueCount / totalCharges) * 100 : 0;
  const avgPaymentTime =
    paidCount > 0 ? Math.max(Math.round((overdueCount / paidCount) * 7), 1) : 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <AppChartPanel
            title="Receita mensal (análise)"
            description="Tendência mensal da receita recebida."
          >
            {revenueData.length === 0 ? (
              <AppPageEmptyState
                title="Sem dados de receita"
                description="Crie cobranças e registre pagamentos para gerar análises."
              />
            ) : (
              <ChartContainer
                className="h-[250px] w-full"
                config={{
                  revenue: { label: "Receita", color: "hsl(194 72% 56%)" },
                }}
              >
                <BarChart
                  data={revenueData}
                  margin={{ left: -12, right: 6, top: 4 }}
                >
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="2 4"
                    stroke="color-mix(in srgb, var(--border-subtle) 45%, transparent)"
                  />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        className="border-[var(--border-subtle)] bg-[var(--surface-elevated)]/95"
                        formatter={value => [
                          `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                          "Receita",
                        ]}
                      />
                    }
                  />
                  <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                    {revenueData.map((_, index) => (
                      <Cell
                        key={`revenue-${index}`}
                        fill="hsl(194 72% 56%)"
                        fillOpacity={0.78}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </AppChartPanel>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <AppSectionBlock
            title="Análise de carteira"
            subtitle="Resumo executivo da saúde financeira."
            compact
          >
            <ul className="space-y-1.5 text-sm text-[var(--text-secondary)]">
              <li>
                <strong>Recebido:</strong> {receivedTotal}
              </li>
              <li>
                <strong>Em aberto:</strong> {openTotal}
              </li>
              <li>
                <strong>Em risco:</strong> {overdueTotal}
              </li>
            </ul>
          </AppSectionBlock>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <AppSectionBlock
              title="Inadimplência"
              subtitle="Participação das vencidas."
              compact
            >
              <p className="text-xl font-semibold text-[var(--text-primary)]">
                {delinquencyRate.toFixed(1).replace(".", ",")}%
              </p>
            </AppSectionBlock>
            <AppSectionBlock
              title="Ticket médio"
              subtitle="Média mensal recebida."
              compact
            >
              <p className="text-xl font-semibold text-[var(--text-primary)]">
                R${" "}
                {defaultTicket.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </AppSectionBlock>
            <AppSectionBlock
              title="Tempo médio de pagamento"
              subtitle="Estimativa operacional atual."
              compact
            >
              <p className="text-xl font-semibold text-[var(--text-primary)]">
                {avgPaymentTime} dias
              </p>
            </AppSectionBlock>
          </div>
        </div>
      </div>

      <AppChartPanel
        title="Distribuição de status"
        description="Mix atual da carteira por estágio."
      >
        <ChartContainer
          className="h-[210px] w-full"
          config={{ value: { label: "Cobranças" } }}
        >
          <BarChart
            data={statusDistribution}
            margin={{ left: -12, right: 4, top: 4 }}
          >
            <CartesianGrid
              vertical={false}
              strokeDasharray="2 4"
              stroke="color-mix(in srgb, var(--border-subtle) 45%, transparent)"
            />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={28} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="border-[var(--border-subtle)] bg-[var(--surface-elevated)]/95"
                  formatter={value => [
                    `${Number(value)} cobrança(s)`,
                    "Volume",
                  ]}
                />
              }
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {statusDistribution.map(entry => (
                <Cell
                  key={entry.label}
                  fill={
                    entry.label.toLowerCase().includes("pend")
                      ? "hsl(214 80% 63%)"
                      : entry.label.toLowerCase().includes("venc")
                        ? "hsl(6 82% 64%)"
                        : "hsl(151 56% 46%)"
                  }
                  fillOpacity={0.78}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </AppChartPanel>
    </div>
  );
}
