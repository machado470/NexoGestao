import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowUpRight, CircleDot, Plus, Sparkles } from "lucide-react";
import { AppChartPanel, AppPageEmptyState, AppSectionBlock } from "@/components/internal-page-system";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/design-system";

interface FinanceReportsProps {
  revenueData: Array<{ label: string; revenue: number }>;
  statusDistribution: Array<{ label: string; value: number }>;
  overdueTotal: string;
  openTotal: string;
  receivedTotal: string;
  overdueTotalValue: number;
  openTotalValue: number;
  receivedTotalValue: number;
  monthlyResult?: any;
  expenses?: any[];
  onCreateExpense?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  HOUSING: "Casa",
  ELECTRICITY: "Luz",
  WATER: "Água",
  INTERNET: "Internet",
  PAYROLL: "Funcionários",
  MARKET: "Mercado",
  TRANSPORT: "Transporte",
  LEISURE: "Lazer",
  OPERATIONS: "Operacional",
  OTHER: "Outros",
};

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function FinanceReports({ overdueTotal, openTotal, receivedTotal, overdueTotalValue, openTotalValue, monthlyResult, expenses = [], onCreateExpense }: FinanceReportsProps) {
  const revenue = Number(monthlyResult?.totalRevenueMonth ?? 0);
  const monthExpenses = Number(monthlyResult?.totalExpensesMonth ?? 0);
  const net = Number(monthlyResult?.netMonthlyResult ?? revenue - monthExpenses);
  const committed = Number(monthlyResult?.committedPercentage ?? (revenue > 0 ? (monthExpenses / revenue) * 100 : 0));
  const pressure = committed > 70 ? "critical" : committed >= 40 ? "attention" : "safe";

  const byCategory = Object.entries(monthlyResult?.expensesByCategory ?? {}).map(([category, value]) => ({ label: CATEGORY_LABELS[category] ?? category, value: Number(value ?? 0), category }));

  const executiveRead = pressure === "critical"
    ? `Resultado sob pressão: ${committed.toFixed(1).replace(".", ",")}% da receita comprometida.`
    : pressure === "attention"
      ? `Atenção: ${committed.toFixed(1).replace(".", ",")}% da receita do mês já foi comprometida.`
      : `Situação segura: despesas consomem ${committed.toFixed(1).replace(".", ",")}% da receita.`;

  return <div className="space-y-5">
    <AppSectionBlock title="Resultado do mês" subtitle="Receita, despesa, risco e leitura executiva no mesmo painel.">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] px-3 py-1 text-xs text-[var(--text-secondary)]"><Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> Hero executivo</div>
        <Button size="sm" onClick={onCreateExpense}><Plus className="mr-1 h-4 w-4" />Nova despesa</Button>
      </div>
      <p className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{formatCurrency(net)}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Resultado líquido disponível no mês atual.</p>
      <div className="mt-4 h-2 rounded-full bg-[var(--surface-secondary)]"><div className={`h-2 rounded-full ${pressure === "critical" ? "bg-rose-500" : pressure === "attention" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(committed, 100)}%` }} /></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
        <div>Receita total: <strong>{formatCurrency(revenue)}</strong></div>
        <div>Despesas totais: <strong>{formatCurrency(monthExpenses)}</strong></div>
        <div>% comprometida: <strong>{committed.toFixed(1).replace(".", ",")}%</strong></div>
      </div>
    </AppSectionBlock>

    <div className="grid gap-3 md:grid-cols-4">
      {[{label:"Receita do mês", value: formatCurrency(revenue)}, {label:"Despesas do mês", value: formatCurrency(monthExpenses)}, {label:"Resultado líquido", value: formatCurrency(net)}, {label:"Percentual comprometido", value: `${committed.toFixed(1).replace(".", ",")}%`}].map(kpi => (
        <div key={kpi.label} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/35 p-3"><p className="text-xs text-[var(--text-muted)]">{kpi.label}</p><p className="mt-1 text-lg font-semibold">{kpi.value}</p></div>
      ))}
    </div>

    <AppChartPanel title="Distribuição de despesas por categoria" description="Composição real dos gastos do mês.">
      {byCategory.length === 0 ? <AppPageEmptyState title="Sem despesas no mês" description="Cadastre despesas para visualizar a composição por categoria." /> : (
        <ChartContainer className="h-[260px] w-full" config={{ value: { label: "Despesa" } }}>
          <BarChart data={byCategory} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 6" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={72} tickFormatter={value => `R$ ${Number(value / 1000).toFixed(0)}k`} />
            <ChartTooltip content={<ChartTooltipContent formatter={(value, _, item) => [`${formatCurrency(Number(value))}`, String(item.payload.label)]} />} />
            <Bar dataKey="value" radius={[10, 10, 4, 4]}>
              {byCategory.map(entry => <Cell key={entry.category} fill="hsl(214 74% 63%)" fillOpacity={0.86} />)}
              <LabelList dataKey="value" position="top" formatter={(value: number) => formatCurrency(value).replace(",00", "")} className="fill-[var(--text-secondary)] text-[11px]" />
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </AppChartPanel>

    <div className="grid gap-4 xl:grid-cols-2">
      <AppSectionBlock title="Pressão de caixa" subtitle="Mantém conexão com carteira operacional atual.">
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between"><span>Valor em aberto</span><strong>{openTotal}</strong></li>
          <li className="flex justify-between"><span>Valor em risco</span><strong>{overdueTotal}</strong></li>
          <li className="flex justify-between"><span>Inadimplência (proxy)</span><strong>{openTotalValue > 0 ? ((overdueTotalValue / openTotalValue) * 100).toFixed(1).replace(".", ",") : "0,0"}%</strong></li>
          <li className="flex justify-between"><span>Receita recebida</span><strong>{receivedTotal}</strong></li>
        </ul>
      </AppSectionBlock>

      <AppSectionBlock title="Leitura executiva / ação recomendada" subtitle="Priorize ações que aumentam o resultado líquido real.">
        <p className="text-sm text-[var(--text-secondary)]">{executiveRead}</p>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">Cobrar vencidas hoje reduz risco e melhora margem real do mês.</p>
        <div className="mt-3 rounded-xl border border-[var(--border-subtle)] p-3 text-xs text-[var(--text-muted)] inline-flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" /> Carteira em risco atual: {formatCurrency(overdueTotalValue)}.</div>
      </AppSectionBlock>
    </div>

    <AppSectionBlock title="Últimas despesas" subtitle="Itens recentes e ativos que entram no resultado do mês.">
      {expenses.length === 0 ? <AppPageEmptyState title="Sem despesas recentes" description="Cadastre uma despesa para iniciar o controle mensal." /> : (
        <div className="space-y-2">{expenses.map(item => <div key={item.id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)]/35 p-3 flex items-center justify-between"><div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-[var(--text-muted)]">{CATEGORY_LABELS[item.category] ?? item.category} · {item.type === "FIXED" ? "Fixa" : "Variável"}{item.recurrence === "MONTHLY" && item.isActive ? " · Recorrente ativa" : ""}</p></div><p className="text-sm font-semibold">{formatCurrency(Number(item.amountCents ?? 0))}</p></div>)}</div>
      )}
    </AppSectionBlock>

    <div className="pointer-events-none mt-1 flex items-center justify-end gap-1.5 pr-2 text-[11px] text-[var(--text-muted)]"><ArrowUpRight className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> Relatórios com resultado real: entrou, saiu, sobrou e risco.</div>
  </div>;
}
