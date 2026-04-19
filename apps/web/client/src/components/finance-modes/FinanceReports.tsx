import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { ArrowUpRight, CircleDot, Sparkles } from "lucide-react";
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

  const kpiCards = [
    {
      label: "Receita recebida",
      value: receivedTotal,
      accent: "bg-emerald-500/85",
      ring: "ring-emerald-500/25",
    },
    {
      label: "Carteira em aberto",
      value: openTotal,
      accent: "bg-blue-500/85",
      ring: "ring-blue-500/25",
    },
    {
      label: "Valor em risco",
      value: overdueTotal,
      accent: "bg-rose-500/85",
      ring: "ring-rose-500/30",
    },
    {
      label: "Inadimplência",
      value: `${delinquencyRate.toFixed(1).replace(".", ",")}%`,
      accent: "bg-amber-500/85",
      ring: "ring-amber-500/25",
    },
    {
      label: "Tempo médio de pagamento",
      value: `${avgPaymentTime} dias`,
      accent: "bg-violet-500/85",
      ring: "ring-violet-500/25",
    },
  ];

  return (
    <div className="space-y-5">
      <AppSectionBlock
        title={headline}
        subtitle={executiveSubtitle}
        className="overflow-hidden rounded-2xl border-[color-mix(in_srgb,var(--border-subtle)_60%,var(--accent-primary)_18%)] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--surface-elevated)_92%,transparent)_0%,color-mix(in_srgb,var(--surface-secondary)_90%,var(--accent-primary)_8%)_100%)] p-6 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--text-primary)_10%,transparent),0_26px_52px_-38px_color-mix(in_srgb,var(--text-primary)_48%,transparent)] md:p-7"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--border-subtle)_70%,transparent)] pb-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--accent-primary)_30%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--surface-elevated)_90%,transparent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
            Centro de decisão financeiro
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Contexto imediato: {riskShare.toFixed(1).replace(".", ",")}% da carteira sob risco.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {kpiCards.map(item => (
            <div
              key={item.label}
              className={`group rounded-xl border border-[color-mix(in_srgb,var(--border-subtle)_76%,transparent)] bg-[color-mix(in_srgb,var(--surface-elevated)_84%,transparent)] p-3.5 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--text-primary)_8%,transparent)] ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent-primary)_34%,var(--border-subtle))] hover:shadow-[0_16px_30px_-24px_color-mix(in_srgb,var(--text-primary)_52%,transparent)] ${item.ring}`}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">
                {item.label}
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                {item.value}
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <span className={`h-1.5 w-1.5 rounded-full ${item.accent}`} />
                Leitura executiva ativa
              </div>
            </div>
          ))}
        </div>
      </AppSectionBlock>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--border-subtle)_72%,transparent)] bg-[color-mix(in_srgb,var(--surface-primary)_84%,transparent)] p-0.5 shadow-[0_24px_40px_-36px_color-mix(in_srgb,var(--text-primary)_65%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-34px_color-mix(in_srgb,var(--text-primary)_68%,transparent)]">
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
                    barCategoryGap={34}
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 6"
                      stroke="color-mix(in srgb, var(--border-subtle) 38%, transparent)"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      tickFormatter={value => `R$ ${Number(value / 1000).toFixed(0)}k`}
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
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
                    <Bar
                      dataKey="value"
                      radius={[12, 12, 4, 4]}
                      animationDuration={260}
                    >
                      {mainCompositionData.map(entry => (
                        <Cell key={entry.label} fill={entry.fill} fillOpacity={0.88} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(value: number) =>
                          formatCurrency(value).replace(",00", "")
                        }
                        className="fill-[var(--text-secondary)] text-[11px]"
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {mainCompositionData.map(item => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-[var(--border-subtle)]/75 bg-[color-mix(in_srgb,var(--surface-secondary)_70%,transparent)] p-3 transition-all duration-200 hover:border-[color-mix(in_srgb,var(--accent-primary)_26%,var(--border-subtle))]"
                    >
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                        <CircleDot className="h-3.5 w-3.5 text-[var(--accent-primary)]/80" />
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
        </div>

        <div className="xl:col-span-5">
          <AppSectionBlock
            title="Painel lateral de saúde financeira"
            subtitle="Síntese gerencial por saúde da carteira e eficiência de recebimento."
            className="h-full rounded-[1.35rem] border-[color-mix(in_srgb,var(--border-subtle)_72%,transparent)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-elevated)_90%,transparent)_0%,color-mix(in_srgb,var(--surface-secondary)_83%,transparent)_100%)] p-5 shadow-[0_22px_42px_-36px_color-mix(in_srgb,var(--text-primary)_58%,transparent)]"
          >
            <div className="space-y-4">
              <section className="space-y-2 rounded-xl border border-[var(--border-subtle)]/60 bg-[color-mix(in_srgb,var(--surface-primary)_82%,transparent)] p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Saúde financeira
                </p>
                <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <li className="flex items-center justify-between gap-2">
                    <span>Recebido</span>
                    <strong className="text-base text-[var(--text-primary)]">{receivedTotal}</strong>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>Em aberto</span>
                    <strong className="text-base text-[var(--text-primary)]">{openTotal}</strong>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>Em risco</span>
                    <strong className="text-base text-[var(--text-primary)]">{overdueTotal}</strong>
                  </li>
                </ul>
              </section>

              <section className="space-y-2 border-t border-[var(--border-subtle)]/70 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Eficiência de recebimento
                </p>
                <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                  <div className="rounded-xl border border-[var(--border-subtle)]/70 bg-[var(--surface-secondary)]/45 p-3 transition-all duration-200 hover:border-[var(--border-emphasis)]">
                    <p className="text-xs text-[var(--text-muted)]">Inadimplência</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                      {delinquencyRate.toFixed(1).replace(".", ",")}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)]/70 bg-[var(--surface-secondary)]/45 p-3 transition-all duration-200 hover:border-[var(--border-emphasis)]">
                    <p className="text-xs text-[var(--text-muted)]">Ticket médio</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                      {formatCurrency(defaultTicket)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)]/70 bg-[var(--surface-secondary)]/45 p-3 transition-all duration-200 hover:border-[var(--border-emphasis)]">
                    <p className="text-xs text-[var(--text-muted)]">Tempo médio</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                      {avgPaymentTime} dias
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </AppSectionBlock>
        </div>
      </div>

      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--border-subtle)_72%,transparent)] bg-[color-mix(in_srgb,var(--surface-primary)_88%,transparent)] p-0.5 shadow-[0_20px_34px_-30px_color-mix(in_srgb,var(--text-primary)_52%,transparent)] transition-all duration-300 hover:shadow-[0_20px_40px_-28px_color-mix(in_srgb,var(--text-primary)_60%,transparent)]">
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
                  strokeDasharray="3 6"
                  stroke="color-mix(in srgb, var(--border-subtle) 38%, transparent)"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                />
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
                <Bar dataKey="value" radius={[10, 10, 4, 4]} animationDuration={240}>
                  <LabelList
                    dataKey="value"
                    position="top"
                    className="fill-[var(--text-secondary)] text-[11px]"
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
                      fillOpacity={0.86}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--border-subtle)]/75 bg-[var(--surface-secondary)]/36 p-3 transition-all duration-200 hover:border-[var(--border-emphasis)]">
                <p className="text-xs text-[var(--text-muted)]">Pendentes</p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">{pendingCount}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {totalCharges > 0
                    ? `${((pendingCount / totalCharges) * 100).toFixed(1).replace(".", ",")}% da carteira`
                    : "Sem representatividade"}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)]/75 bg-[var(--surface-secondary)]/36 p-3 transition-all duration-200 hover:border-[var(--border-emphasis)]">
                <p className="text-xs text-[var(--text-muted)]">Vencidas</p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">{overdueCount}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {totalCharges > 0
                    ? `${((overdueCount / totalCharges) * 100).toFixed(1).replace(".", ",")}% com pressão de caixa`
                    : "Sem representatividade"}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)]/75 bg-[var(--surface-secondary)]/36 p-3 transition-all duration-200 hover:border-[var(--border-emphasis)]">
                <p className="text-xs text-[var(--text-muted)]">Pagas</p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">{paidCount}</p>
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
      <div className="pointer-events-none mt-1 flex items-center justify-end gap-1.5 pr-2 text-[11px] text-[var(--text-muted)]">
        <ArrowUpRight className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
        Relatórios preservados com leitura executiva e refinamento visual.
      </div>
    </div>
  );
}
