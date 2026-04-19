import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { AppChartPanel, AppPageEmptyState, AppSectionBlock } from "@/components/internal-page-system";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface FinanceReportsProps {
  revenueData: Array<{ label: string; revenue: number }>;
  statusDistribution: Array<{ label: string; value: number }>;
  overdueTotal: string;
  openTotal: string;
  receivedTotal: string;
}

export function FinanceReports({ revenueData, statusDistribution, overdueTotal, openTotal, receivedTotal }: FinanceReportsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <AppChartPanel title="Receita mensal (análise)" description="Gráfico ampliado para leitura de tendência e sazonalidade.">
            {revenueData.length === 0 ? (
              <AppPageEmptyState title="Sem dados de receita" description="Crie cobranças e registre pagamentos para gerar análises." />
            ) : (
              <ChartContainer className="h-[360px] w-full" config={{ revenue: { label: "Receita" } }}>
                <BarChart data={revenueData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="var(--brand-primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </AppChartPanel>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <AppSectionBlock title="Análise de carteira" subtitle="Resumo executivo sem lista operacional.">
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li><strong>Recebido:</strong> {receivedTotal}</li>
              <li><strong>Em aberto:</strong> {openTotal}</li>
              <li><strong>Em risco (vencido):</strong> {overdueTotal}</li>
            </ul>
          </AppSectionBlock>
        </div>
      </div>

      <AppChartPanel title="Distribuição de status" description="Entenda o mix atual da carteira.">
        <ChartContainer className="h-[320px] w-full" config={{ value: { label: "Cobranças" } }}>
          <BarChart data={statusDistribution}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--brand-accent)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </AppChartPanel>
    </div>
  );
}
