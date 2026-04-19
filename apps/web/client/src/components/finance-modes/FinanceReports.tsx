import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
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
  overdueTotalValue: number;
  openTotalValue: number;
  receivedTotalValue: number;
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function FinanceReports({
  revenueData,
  statusDistribution,
  overdueTotal,
  openTotal,
  receivedTotal,
  overdueTotalValue,
  openTotalValue,
  receivedTotalValue,
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
  const pendingCount =
    statusDistribution.find(item => item.label.toLowerCase().includes("pend"))
      ?.value ?? 0;

  const defaultTicket = revenueData.length
    ? revenueData.reduce((acc, item) => acc + item.revenue, 0) /
      revenueData.length
    : 0;
  const delinquencyRate =
    totalCharges > 0 ? (overdueCount / totalCharges) * 100 : 0;
  const avgPaymentTime =
    paidCount > 0 ? Math.max(Math.round((overdueCount / paidCount) * 7), 1) : 0;

  const riskShare =
    receivedTotalValue + openTotalValue > 0
      ? (overdueTotalValue / (receivedTotalValue + openTotalValue)) * 100
      : 0;

  const headline =
    delinquencyRate >= 25 || riskShare >= 22
      ? "Carteira em pressão: inadimplência e prazo exigem atenção"
      : openTotalValue > receivedTotalValue * 0.85
        ? "Receita sob controle, mas com execução pendente relevante"
        : "Proteja caixa com execução priorizada sobre vencidas";

  const executiveSubtitle =
    "Leitura integrada entre entrada de caixa, saldo em aberto e risco operacional para orientar decisão imediata.";

  const mainCompositionData = [
    {
      label: "Recebido",
      value: receivedTotalValue,
      context: "Entrada consolidada no período",
      fill: "hsl(154 49% 46%)",
    },
    {
      label: "Em aberto",
      value: openTotalValue,
      context: "Valor a executar em cobrança",
      fill: "hsl(214 74% 63%)",
    },
    {
      label: "Em risco",
      value: overdueTotalValue,
      context: "Pressão direta sobre o caixa",
      fill: "hsl(8 76% 62%)",
    },
  ];

  return (
    <div className="space-y-4">
      <AppSectionBlock
        title={headline}
        subtitle={executiveSubtitle}
        className="p-5 md:p-6"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/55 p-3">
            <p className="text-xs text-[var(--text-muted)]">Receita recebida</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {receivedTotal}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/55 p-3">
            <p className="text-xs text-[var(--text-muted)]">Carteira em aberto</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{openTotal}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/55 p-3">
            <p className="text-xs text-[var(--text-muted)]">Valor em risco</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {overdueTotal}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/55 p-3">
            <p className="text-xs text-[var(--text-muted)]">Inadimplência</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {delinquencyRate.toFixed(1).replace(".", ",")}%
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/55 p-3">
            <p className="text-xs text-[var(--text-muted)]">Tempo médio de pagamento</p>
            <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {avgPaymentTime} dias
            </p>
          </div>
        </div>
      </AppSectionBlock>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <AppChartPanel
            title="Receita e pressão de carteira"
            description="Comparativo executivo entre valor recebido, saldo aberto e valor em risco no período atual."
            trendLabel="Leitura operacional: execute cobrança sobre em aberto para reduzir pressão de vencidas."
          >
            {mainCompositionData.every(item => item.value <= 0) ? (
              <AppPageEmptyState
                title="Sem dados financeiros para análise"
                description="Crie cobranças e registre pagamentos para montar leitura executiva da carteira."
              />
            ) : (
              <>
                <ChartContainer
                  className="h-[280px] w-full"
                  config={{
                    value: { label: "Valor", color: "hsl(214 74% 63%)" },
                  }}
                >
                  <BarChart
                    data={mainCompositionData}
                    margin={{ left: -8, right: 14, top: 8, bottom: 0 }}
                    barCategoryGap={28}
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="2 4"
                      stroke="color-mix(in srgb, var(--border-subtle) 45%, transparent)"
                    />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      tickFormatter={value => `R$ ${Number(value / 1000).toFixed(0)}k`}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          className="border-[var(--border-subtle)] bg-[var(--surface-elevated)]/95"
                          formatter={(value, _name, item) => [
                            `${formatCurrency(Number(value))}`,
                            String(item.payload.context),
                          ]}
                        />
                      }
                    />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {mainCompositionData.map(entry => (
                        <Cell key={entry.label} fill={entry.fill} fillOpacity={0.84} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(value: number) =>
                          formatCurrency(value).replace(",00", "")
                        }
                        className="fill-[var(--text-muted)] text-[11px]"
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {mainCompositionData.map(item => (
                    <div
                      key={item.label}
                      className="rounded-md border border-[var(--border-subtle)]/80 bg-[var(--surface-secondary)]/45 p-2.5"
                    >
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">{item.context}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </AppChartPanel>
        </div>

        <div className="xl:col-span-4">
          <AppSectionBlock
            title="Painel lateral de saúde financeira"
            subtitle="Síntese gerencial por saúde da carteira e eficiência de recebimento."
            className="h-full p-5"
          >
            <div className="space-y-4">
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Saúde financeira
                </p>
                <ul className="space-y-1.5 text-sm text-[var(--text-secondary)]">
                  <li className="flex items-center justify-between gap-2">
                    <span>Recebido</span>
                    <strong className="text-[var(--text-primary)]">{receivedTotal}</strong>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>Em aberto</span>
                    <strong className="text-[var(--text-primary)]">{openTotal}</strong>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>Em risco</span>
                    <strong className="text-[var(--text-primary)]">{overdueTotal}</strong>
                  </li>
                </ul>
              </section>

              <section className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Eficiência de recebimento
                </p>
                <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/45 p-3">
                    <p className="text-xs text-[var(--text-muted)]">Inadimplência</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                      {delinquencyRate.toFixed(1).replace(".", ",")}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/45 p-3">
                    <p className="text-xs text-[var(--text-muted)]">Ticket médio</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                      {formatCurrency(defaultTicket)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/45 p-3">
                    <p className="text-xs text-[var(--text-muted)]">Tempo médio</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
                      {avgPaymentTime} dias
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </AppSectionBlock>
        </div>
      </div>

      <AppChartPanel
        title="Distribuição operacional da carteira"
        description="Peso relativo de pendentes, vencidas e pagas para fechar leitura de composição e risco."
      >
        {statusDistribution.length === 0 ? (
          <AppPageEmptyState
            title="Sem status para distribuir"
            description="Registre cobranças para visualizar composição operacional da carteira."
          />
        ) : (
          <>
            <ChartContainer
              className="h-[240px] w-full"
              config={{ value: { label: "Cobranças" } }}
            >
              <BarChart
                data={statusDistribution}
                margin={{ left: -8, right: 8, top: 8, bottom: 0 }}
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
                      formatter={(value, _name, item) => {
                        const percentage =
                          totalCharges > 0
                            ? (Number(value) / totalCharges) * 100
                            : 0;
                        return [
                          `${Number(value)} cobrança(s) · ${percentage.toFixed(1).replace(".", ",")}%`,
                          String(item.payload.label),
                        ];
                      }}
                    />
                  }
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  <LabelList
                    dataKey="value"
                    position="top"
                    className="fill-[var(--text-muted)] text-[11px]"
                  />
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
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--border-subtle)]/80 bg-[var(--surface-secondary)]/45 p-3">
                <p className="text-xs text-[var(--text-muted)]">Pendentes</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-primary)]">{pendingCount}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {totalCharges > 0
                    ? `${((pendingCount / totalCharges) * 100).toFixed(1).replace(".", ",")}% da carteira`
                    : "Sem representatividade"}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)]/80 bg-[var(--surface-secondary)]/45 p-3">
                <p className="text-xs text-[var(--text-muted)]">Vencidas</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-primary)]">{overdueCount}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {totalCharges > 0
                    ? `${((overdueCount / totalCharges) * 100).toFixed(1).replace(".", ",")}% com pressão de caixa`
                    : "Sem representatividade"}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)]/80 bg-[var(--surface-secondary)]/45 p-3">
                <p className="text-xs text-[var(--text-muted)]">Pagas</p>
                <p className="mt-1 text-base font-semibold text-[var(--text-primary)]">{paidCount}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {totalCharges > 0
                    ? `${((paidCount / totalCharges) * 100).toFixed(1).replace(".", ",")}% concluído no ciclo`
                    : "Sem representatividade"}
                </p>
              </div>
            </div>
          </>
        )}
      </AppChartPanel>
    </div>
  );
}
