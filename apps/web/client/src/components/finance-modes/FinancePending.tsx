import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AppDataTable,
  AppPageEmptyState,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface FinancePendingProps {
  charges: any[];
  onRemind: (charge?: any) => void;
  formatCurrency: (cents: number) => string;
}

function daysUntil(dateValue: unknown) {
  if (!dateValue) return null;
  const dueDate = new Date(String(dateValue));
  const today = new Date();
  const diff = dueDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function FinancePending({
  charges,
  onRemind,
  formatCurrency,
}: FinancePendingProps) {
  const pendingTotal = charges.reduce(
    (acc, charge) => acc + Number(charge?.amountCents ?? 0),
    0
  );

  const dueSoon = charges.filter(charge => {
    const days = daysUntil(charge?.dueDate);
    return days !== null && days >= 0 && days <= 7;
  }).length;

  const overdueByMistake = charges.filter(charge => {
    const days = daysUntil(charge?.dueDate);
    return days !== null && days < 0;
  }).length;

  const distributionByWindow = useMemo(() => {
    const buckets = [
      { label: "Hoje", min: 0, max: 0, value: 0 },
      { label: "1-3 dias", min: 1, max: 3, value: 0 },
      { label: "4-7 dias", min: 4, max: 7, value: 0 },
      { label: "8+ dias", min: 8, max: 999, value: 0 },
    ];

    charges.forEach(charge => {
      const days = daysUntil(charge?.dueDate);
      if (days === null || days < 0) return;
      const bucket = buckets.find(item => days >= item.min && days <= item.max);
      if (bucket) bucket.value += 1;
    });

    return buckets;
  }, [charges]);

  const distributionByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    charges.forEach(charge => {
      const customerName = String(charge?.customer?.name ?? "Sem cliente");
      map.set(customerName, (map.get(customerName) ?? 0) + Number(charge?.amountCents ?? 0));
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [charges]);

  if (charges.length === 0) {
    return (
      <AppPageEmptyState
        title="Sem cobranças pendentes"
        description="Sua operação está em dia neste momento."
      />
    );
  }

  return (
    <div className="space-y-5">
      <AppSectionBlock
        title="Cobranças pendentes"
        subtitle="Acompanhamento preventivo para reduzir virada para vencidas."
      >
        <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
          <div className="grid min-w-0 gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
              <p className="text-xs text-[var(--text-muted)]">Total pendente</p>
              <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">{formatCurrency(pendingTotal)}</p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
              <p className="text-xs text-[var(--text-muted)]">Cobranças abertas</p>
              <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">{charges.length}</p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
              <p className="text-xs text-[var(--text-muted)]">Vencendo em breve</p>
              <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">{dueSoon}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/35 p-4">
            <p className="text-sm font-medium text-[var(--text-primary)]">Lembrar em lote</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Dispare lembrete agora para reduzir risco de atraso nas próximas 72h.
            </p>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">Risco de virada: {overdueByMistake} item(ns).</span>
              <ActionFeedbackButton
                state="idle"
                idleLabel="Enviar lembretes"
                onClick={() => onRemind()}
              />
            </div>
          </div>
        </div>
      </AppSectionBlock>

      <div className="grid gap-4 xl:grid-cols-2">
        <AppSectionBlock
          title="Pendências por vencimento"
          subtitle="Organize o dia pela janela de vencimento."
          compact
        >
          <ChartContainer className="h-[220px] w-full" config={{ value: { label: "Cobranças" } }}>
            <BarChart data={distributionByWindow}>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={[8, 8, 4, 4]} fill="hsl(var(--accent))" />
            </BarChart>
          </ChartContainer>
        </AppSectionBlock>

        <AppSectionBlock
          title="Pendente por cliente"
          subtitle="Clientes com maior concentração de valor pendente."
          compact
        >
          <div className="space-y-2">
            {distributionByCustomer.map(item => {
              const ratio = pendingTotal > 0 ? (item.value / pendingTotal) * 100 : 0;
              return (
                <div
                  key={item.label}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/35 p-3"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.label}</p>
                    <p className="shrink-0 text-xs font-semibold text-[var(--text-primary)]">
                      {formatCurrency(item.value)}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-elevated)]">
                    <div className="h-1.5 rounded-full bg-[var(--accent-primary)]/80" style={{ width: `${Math.max(ratio, 8)}%` }} />
                  </div>
                </div>
              );
            })}
            {distributionByCustomer.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-xs text-[var(--text-muted)]">
                Sem concentração relevante por cliente.
              </div>
            ) : null}
          </div>
        </AppSectionBlock>
      </div>

      <AppSectionBlock
        title="Lista de acompanhamento"
        subtitle="Priorize contato com contexto, status e próxima ação."
        compact
      >
        <AppDataTable>
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
              <tr>
                <th className="p-2.5 text-left">Cliente</th>
                <th className="text-left">Valor</th>
                <th className="text-left">Vencimento</th>
                <th className="text-left">Janela</th>
                <th className="text-left">Status</th>
                <th className="p-2.5 text-left">Ação</th>
              </tr>
            </thead>
            <tbody>
              {charges.map(charge => {
                const days = daysUntil(charge?.dueDate);
                const windowLabel =
                  days === null
                    ? "Sem data"
                    : days < 0
                      ? `${Math.abs(days)} dia(s) de atraso`
                      : days === 0
                        ? "Vence hoje"
                        : `${days} dia(s)`;
                return (
                  <tr
                    key={String(charge?.id)}
                    className="border-t border-[var(--border-subtle)]"
                  >
                    <td className="p-2.5">{String(charge?.customer?.name ?? "—")}</td>
                    <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                    <td>
                      {charge?.dueDate
                        ? new Date(String(charge.dueDate)).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="text-xs text-[var(--text-secondary)]">{windowLabel}</td>
                    <td>
                      <AppStatusBadge label={days !== null && days <= 2 ? "Atenção" : "Pendente"} />
                    </td>
                    <td className="p-2.5">
                      <ActionFeedbackButton
                        state="idle"
                        idleLabel="Lembrar"
                        onClick={() => onRemind(charge)}
                      />
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
