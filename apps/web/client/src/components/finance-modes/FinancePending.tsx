import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AppDataTable,
  AppPageEmptyState,
  AppSectionBlock,
  AppStatusBadge,
  appSelectionPillClasses,
} from "@/components/internal-page-system";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface FinancePendingProps {
  charges: any[];
  onRemind: (charge?: any) => void;
  formatCurrency: (cents: number) => string;
  reminderStats: {
    automationStatus: string;
    queue: number;
    sent: number;
    delivered: number;
    failed: number;
    nextExecution: string;
    lastExecution: string;
  };
  priorityCharge: any | null;
  focusedCustomerId: string | null;
  onFocusCustomer: (customerId: string | null) => void;
  activeWindow: string | null;
  onWindowChange: (window: string | null) => void;
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
  reminderStats,
  priorityCharge,
  focusedCustomerId,
  onFocusCustomer,
  activeWindow,
  onWindowChange,
}: FinancePendingProps) {
  const pendingTotal = charges.reduce(
    (acc, charge) => acc + Number(charge?.amountCents ?? 0),
    0
  );

  const dueSoon72h = charges.filter(charge => {
    const days = daysUntil(charge?.dueDate);
    return days !== null && days >= 0 && days <= 3;
  });

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
    const map = new Map<string, { value: number; id: string }>();
    charges.forEach(charge => {
      const customerId = String(charge?.customerId ?? charge?.customer?.id ?? "sem-cliente");
      const customerName = String(charge?.customer?.name ?? "Sem cliente");
      const current = map.get(customerId) ?? { value: 0, id: customerId };
      map.set(customerId, { ...current, value: current.value + Number(charge?.amountCents ?? 0) });
      if (customerName !== customerId) map.set(`${customerId}::name`, { id: customerName, value: 0 });
    });
    return [...map.entries()]
      .filter(([key]) => !key.endsWith("::name"))
      .map(([id, value]) => ({
        id,
        label: map.get(`${id}::name`)?.id ?? "Sem cliente",
        value: value.value,
      }))
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
        subtitle="Acompanhamento preventivo para evitar virada para vencidas."
      >
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
            <p className="text-xs text-[var(--text-muted)]">Valor em acompanhamento</p>
            <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">{formatCurrency(pendingTotal)}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{charges.length} cobrança(s) no período/filtro atual.</p>
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
            <p className="text-xs text-[var(--text-muted)]">Janela crítica 72h</p>
            <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">{dueSoon72h.length}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Risco de virada: {formatCurrency(dueSoon72h.reduce((acc, item) => acc + Number(item?.amountCents ?? 0), 0))}.</p>
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
            <p className="text-xs text-[var(--text-muted)]">Cobrança prioritária</p>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--text-primary)]">{priorityCharge ? String(priorityCharge?.customer?.name ?? "Cliente") : "Sem prioridade"}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{priorityCharge ? `${formatCurrency(Number(priorityCharge?.amountCents ?? 0))} · ${priorityCharge?.dueDate ? new Date(String(priorityCharge?.dueDate)).toLocaleDateString("pt-BR") : "sem prazo"}` : "Nenhum item com criticidade."}</p>
            <div className="mt-2">
              <ActionFeedbackButton
                state="idle"
                idleLabel="Focar cobrança"
                onClick={() => onFocusCustomer(String(priorityCharge?.customerId ?? priorityCharge?.customer?.id ?? ""))}
              />
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
            <p className="text-xs text-[var(--text-muted)]">Motor de lembretes</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{reminderStats.automationStatus}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Elegíveis: {reminderStats.queue} · Próxima execução: {reminderStats.nextExecution}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Último resultado: {reminderStats.lastExecution}</p>
            <div className="mt-2">
              <ActionFeedbackButton state="idle" idleLabel="Executar agora" onClick={() => onRemind()} />
            </div>
          </div>
        </div>
      </AppSectionBlock>

      <div className="grid gap-4 xl:grid-cols-2">
        <AppSectionBlock
          title="Pendências por vencimento"
          subtitle="Clique na faixa para focar a lista abaixo."
          compact
        >
          <div className="mb-3 flex flex-wrap gap-2">
            {activeWindow ? (
              <button type="button" className={appSelectionPillClasses(false)} onClick={() => onWindowChange(null)}>
                Limpar faixa: {activeWindow}
              </button>
            ) : null}
          </div>
          <ChartContainer className="h-[220px] w-full" config={{ value: { label: "Cobranças" } }}>
            <BarChart data={distributionByWindow}>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={[8, 8, 4, 4]} fill="hsl(var(--accent))" onClick={data => onWindowChange(String((data as any)?.label ?? null))} />
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
              const active = focusedCustomerId === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onFocusCustomer(active ? null : item.id)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/35 p-3 text-left"
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
                </button>
              );
            })}
          </div>
        </AppSectionBlock>
      </div>

      <AppSectionBlock
        title="Lista de acompanhamento"
        subtitle="A lista é consequência dos filtros ativos acima."
        compact
      >
        <div className="mb-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
          {focusedCustomerId ? <span>Cliente em foco ativo.</span> : null}
          {activeWindow ? <span>Faixa ativa: {activeWindow}.</span> : null}
          {!focusedCustomerId && !activeWindow ? <span>Sem filtros ativos.</span> : null}
        </div>
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

      <AppSectionBlock
        title="Auditoria do motor de lembretes"
        subtitle="Status nativo: queued, sent, delivered e failed."
        compact
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "queued", value: reminderStats.queue },
            { label: "sent", value: reminderStats.sent },
            { label: "delivered", value: reminderStats.delivered },
            { label: "failed", value: reminderStats.failed },
          ].map(item => (
            <div key={item.label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/35 p-3">
              <p className="text-xs text-[var(--text-muted)]">{item.label}</p>
              <p className="mt-1 text-lg font-semibold leading-tight">{item.value}</p>
            </div>
          ))}
        </div>
      </AppSectionBlock>
    </div>
  );
}
