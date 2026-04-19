import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
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
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
              <p className="text-xs text-[var(--text-muted)]">Total pendente</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{formatCurrency(pendingTotal)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
              <p className="text-xs text-[var(--text-muted)]">Cobranças abertas</p>
              <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{charges.length}</p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-xs text-amber-100/80">Vencendo em breve</p>
              <p className="mt-1 text-2xl font-semibold text-amber-100">{dueSoon}</p>
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
          subtitle="Quem concentra maior valor pendente agora."
          compact
        >
          <ChartContainer className="h-[220px] w-full" config={{ value: { label: "Valor" } }}>
            <PieChart>
              <Pie
                data={distributionByCustomer}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={78}
                paddingAngle={3}
              >
                {distributionByCustomer.map((_, index) => (
                  <Cell
                    key={`cliente-${index}`}
                    fill={["#5b8cff", "#42b8a8", "#9a7bff", "#ff9d5c", "#ff6f9f"][index % 5]}
                  />
                ))}
              </Pie>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={value => [formatCurrency(Number(value)), "Valor pendente"]}
                  />
                }
              />
            </PieChart>
          </ChartContainer>
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
