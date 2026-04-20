import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AppDataTable,
  AppPageEmptyState,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface FinancePaidProps {
  charges: any[];
  formatCurrency: (cents: number) => string;
}

function delayInDays(charge: any) {
  if (!charge?.paidAt || !charge?.dueDate) return 0;
  const delta =
    new Date(String(charge.paidAt)).getTime() - new Date(String(charge.dueDate)).getTime();
  return Math.max(Math.floor(delta / (1000 * 60 * 60 * 24)), 0);
}

export function FinancePaid({ charges, formatCurrency }: FinancePaidProps) {
  const sorted = [...charges].sort((a, b) => {
    const aPaid = a?.paidAt ? new Date(String(a.paidAt)).getTime() : 0;
    const bPaid = b?.paidAt ? new Date(String(b.paidAt)).getTime() : 0;
    return bPaid - aPaid;
  });

  const onTimeCount = sorted.filter(charge => delayInDays(charge) === 0).length;
  const delayedCount = sorted.length - onTimeCount;
  const avgDaysToPay = sorted.length
    ? Math.round(sorted.reduce((acc, charge) => acc + delayInDays(charge), 0) / sorted.length)
    : 0;
  const receivedTotal = sorted.reduce((acc, charge) => acc + Number(charge?.amountCents ?? 0), 0);

  const paymentsByMonth = useMemo(() => {
    const map = new Map<string, number>();
    sorted.forEach(charge => {
      if (!charge?.paidAt) return;
      const key = new Date(String(charge.paidAt)).toLocaleDateString("pt-BR", {
        month: "short",
      });
      map.set(key, (map.get(key) ?? 0) + Number(charge?.amountCents ?? 0));
    });
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  }, [sorted]);

  const methodData = useMemo(() => {
    const map = new Map<string, number>();
    sorted.forEach(charge => {
      const method = String(charge?.paymentMethod ?? "Não informado");
      map.set(method, (map.get(method) ?? 0) + 1);
    });
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  }, [sorted]);

  if (charges.length === 0) {
    return (
      <AppPageEmptyState
        title="Sem histórico de pagamentos"
        description="Pagamentos confirmados aparecerão aqui."
      />
    );
  }

  return (
    <div className="space-y-5">
      <AppSectionBlock
        title="Resultado de recebimentos"
        subtitle="Leitura de eficiência com histórico consolidado."
        className="border-emerald-500/25 bg-emerald-500/8"
      >
        <div className="grid min-w-0 gap-3 grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
            <p className="text-xs text-[var(--text-muted)]">Total recebido</p>
            <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">{formatCurrency(receivedTotal)}</p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
            <p className="text-xs text-[var(--text-muted)]">Quantidade paga</p>
            <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">{sorted.length}</p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
            <p className="text-xs text-[var(--text-muted)]">Média de atraso</p>
            <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">{avgDaysToPay} dia(s)</p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
            <p className="text-xs text-[var(--text-muted)]">Métodos de pagamento</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-tight text-[var(--text-primary)]">
              {methodData.length > 0 ? methodData.map(item => item.label).slice(0, 3).join(", ") : "Sem dados"}
            </p>
          </div>
        </div>
      </AppSectionBlock>

      <div className="grid gap-4 xl:grid-cols-2">
        <AppSectionBlock title="Histórico de recebimentos" subtitle="Valor recebido por período." compact>
          <ChartContainer className="h-[220px] w-full" config={{ value: { label: "Recebido" } }}>
            <BarChart data={paymentsByMonth}>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={value => `R$ ${Math.round(Number(value) / 1000)}k`} />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={value => [formatCurrency(Number(value)), "Recebido"]} />
                }
              />
              <Bar dataKey="value" radius={[8, 8, 4, 4]} fill="#34d399" />
            </BarChart>
          </ChartContainer>
        </AppSectionBlock>

        <AppSectionBlock title="Distribuição por método" subtitle="Métodos com maior recorrência de recebimento." compact>
          <div className="space-y-2">
            {methodData
              .sort((a, b) => b.value - a.value)
              .slice(0, 5)
              .map(item => {
                const ratio = sorted.length > 0 ? (item.value / sorted.length) * 100 : 0;
                return (
                  <div
                    key={item.label}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/35 p-3"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                      <p className="shrink-0 text-xs text-[var(--text-secondary)]">{item.value} pagamento(s)</p>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-elevated)]">
                      <div className="h-1.5 rounded-full bg-emerald-400/80" style={{ width: `${Math.max(ratio, 8)}%` }} />
                    </div>
                  </div>
                );
              })}
            {methodData.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-xs text-[var(--text-muted)]">
                Sem dados de método para exibir.
              </div>
            ) : null}
          </div>
        </AppSectionBlock>
      </div>

      <AppSectionBlock
        title="Tabela de pagamentos"
        subtitle="Mostra pontualidade, data de pagamento e resultado por cobrança."
        compact
      >
        <div className="mb-3 grid gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/35 p-3 sm:grid-cols-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Pagas em dia: <strong className="text-[var(--text-primary)]">{onTimeCount}</strong>
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Pagas com atraso: <strong className="text-[var(--text-primary)]">{delayedCount}</strong>
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Boa performance: manter mais de 80% das cobranças em dia.
          </p>
        </div>
        <AppDataTable>
          <table className="w-full text-sm">
            <thead className="bg-emerald-500/10 text-xs text-emerald-100">
              <tr>
                <th className="p-2.5 text-left">Cliente</th>
                <th className="text-left">Valor</th>
                <th className="text-left">Pago em</th>
                <th className="text-left">Pontualidade</th>
                <th className="p-2.5 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(charge => {
                const delay = delayInDays(charge);
                return (
                  <tr key={String(charge?.id)} className="border-t border-emerald-300/40">
                    <td className="p-2.5">{String(charge?.customer?.name ?? "—")}</td>
                    <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                    <td>
                      {charge?.paidAt
                        ? new Date(String(charge.paidAt)).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="text-xs text-[var(--text-secondary)]">
                      {delay === 0 ? "Pago em dia" : `Pago com ${delay} dia(s) de atraso`}
                    </td>
                    <td className="p-2.5">
                      <AppStatusBadge label="Pago" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AppDataTable>
      </AppSectionBlock>
    </div>
  );
}
