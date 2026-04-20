import { useMemo } from "react";
import {
  AppDataTable,
  AppPageEmptyState,
  AppSectionBlock,
  AppStatusBadge,
  appSelectionPillClasses,
} from "@/components/internal-page-system";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { cn } from "@/lib/utils";

interface FinanceOverdueProps {
  charges: any[];
  formatCurrency: (cents: number) => string;
  onCharge: (charge?: any) => void;
  selectedBand: string | null;
  onBandChange: (band: string | null) => void;
  selectedCustomer: string | null;
  onCustomerChange: (customerId: string | null) => void;
}

function getDaysOverdue(dueDate: unknown) {
  if (!dueDate) return 0;
  const due = new Date(String(dueDate));
  const delta = Date.now() - due.getTime();
  return Math.max(Math.floor(delta / (1000 * 60 * 60 * 24)), 0);
}

function getBand(days: number) {
  if (days <= 3) return "Até 3 dias";
  if (days <= 7) return "4 a 7 dias";
  if (days <= 15) return "8 a 15 dias";
  return "+ de 15 dias";
}

export function FinanceOverdue({
  charges,
  formatCurrency,
  onCharge,
  selectedBand,
  onBandChange,
  selectedCustomer,
  onCustomerChange,
}: FinanceOverdueProps) {
  const sorted = [...charges].sort(
    (a, b) => getDaysOverdue(b?.dueDate) - getDaysOverdue(a?.dueDate)
  );
  const riskTotal = sorted.reduce(
    (acc, charge) => acc + Number(charge?.amountCents ?? 0),
    0
  );
  const maxDaysOverdue = sorted[0] ? getDaysOverdue(sorted[0]?.dueDate) : 0;
  const averageOverdue =
    sorted.length > 0
      ? Math.round(sorted.reduce((acc, item) => acc + getDaysOverdue(item?.dueDate), 0) / sorted.length)
      : 0;

  const bucketData = useMemo(() => {
    const map = new Map<string, { count: number; totalCents: number }>();
    sorted.forEach(item => {
      const label = getBand(getDaysOverdue(item?.dueDate));
      const previous = map.get(label) ?? { count: 0, totalCents: 0 };
      map.set(label, {
        count: previous.count + 1,
        totalCents: previous.totalCents + Number(item?.amountCents ?? 0),
      });
    });
    return ["Até 3 dias", "4 a 7 dias", "8 a 15 dias", "+ de 15 dias"].map(label => ({
      label,
      count: map.get(label)?.count ?? 0,
      totalCents: map.get(label)?.totalCents ?? 0,
    }));
  }, [sorted]);

  const topImpact = useMemo(() => {
    const customerTotals = new Map<
      string,
      { customerName: string; totalCents: number; chargesCount: number }
    >();
    sorted.forEach(item => {
      const customerId = String(item?.customer?.id ?? item?.customer?.name ?? "sem-cliente");
      const customerName = String(item?.customer?.name ?? "Sem cliente");
      const current = customerTotals.get(customerId) ?? {
        customerName,
        totalCents: 0,
        chargesCount: 0,
      };
      customerTotals.set(customerId, {
        customerName,
        totalCents: current.totalCents + Number(item?.amountCents ?? 0),
        chargesCount: current.chargesCount + 1,
      });
    });
    return [...customerTotals.entries()]
      .map(([customerId, item]) => ({ customerId, ...item }))
      .sort((a, b) => b.totalCents - a.totalCents)
      .slice(0, 5);
  }, [sorted]);

  const maxBandCount = Math.max(...bucketData.map(item => item.count), 1);
  const topImpactTotal = topImpact.reduce((acc, item) => acc + item.totalCents, 0);

  const filtered = useMemo(
    () =>
      sorted.filter(charge => {
        const inBand = selectedBand ? getBand(getDaysOverdue(charge?.dueDate)) === selectedBand : true;
        const inCustomer = selectedCustomer
          ? String(charge?.customer?.id ?? charge?.customer?.name ?? "sem-cliente") === selectedCustomer
          : true;
        return inBand && inCustomer;
      }),
    [selectedBand, selectedCustomer, sorted]
  );

  const focusDescription = [
    selectedBand ? `Faixa: ${selectedBand}` : null,
    selectedCustomer
      ? `Cliente: ${topImpact.find(item => item.customerId === selectedCustomer)?.customerName ?? "Selecionado"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (sorted.length === 0) {
    return (
      <AppPageEmptyState
        title="Sem cobranças vencidas"
        description="Excelente: não há risco crítico aberto."
      />
    );
  }

  return (
    <div className="space-y-5">
      <AppSectionBlock
        title="Cobranças vencidas"
        subtitle="Recuperação imediata de caixa com foco no que mais pesa."
        className="border-[var(--border-subtle)] bg-[var(--surface-base)]/30"
      >
        <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
          <div className="grid min-w-0 gap-3 grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
              <p className="text-xs text-[var(--text-muted)]">Total vencido</p>
              <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">
                {formatCurrency(riskTotal)}
              </p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
              <p className="text-xs text-[var(--text-muted)]">Quantidade vencida</p>
              <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">
                {sorted.length}
              </p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
              <p className="text-xs text-[var(--text-muted)]">Maior atraso</p>
              <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">
                {maxDaysOverdue}d
              </p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/45 p-4">
              <p className="text-xs text-[var(--text-muted)]">Impacto no caixa</p>
              <p className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--text-primary)] md:text-2xl">
                {riskTotal > 0 ? `${Math.min(Math.round((riskTotal / 5000000) * 100), 100)}%` : "0%"}
              </p>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)]/35 p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">O que cobrar primeiro</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Comece por cobranças acima da média de atraso ({averageOverdue} dias) e maior valor.
            </p>
            {focusDescription ? (
              <p className="mt-2 text-xs font-medium text-[var(--text-primary)]">{focusDescription}</p>
            ) : null}
            <ActionFeedbackButton
              state="idle"
              idleLabel={focusDescription ? "Cobrar foco selecionado" : "Cobrar prioridade agora"}
              onClick={() => onCharge(filtered[0] ?? sorted[0])}
            />
          </div>
        </div>
      </AppSectionBlock>

      <div className="grid gap-4 xl:grid-cols-2">
        <AppSectionBlock
          title="Faixas de atraso"
          subtitle="Visual operacional para conduzir a rotina diária de cobrança."
          compact
          className="border-[var(--border-subtle)]"
        >
          <div className="space-y-2">
            {bucketData.map(item => {
              const isActive = selectedBand === item.label;
              const width = `${Math.max((item.count / maxBandCount) * 100, item.count > 0 ? 10 : 0)}%`;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onBandChange(isActive ? null : item.label)}
                  className={cn(
                    "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/35 p-3 text-left transition hover:border-[var(--border-emphasis)] hover:bg-[var(--surface-base)]/55",
                    isActive && "border-[var(--border-emphasis)] bg-[var(--surface-base)]/55"
                  )}
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
                    <span className="shrink-0 text-xs text-[var(--text-secondary)]">
                      {item.count} cobrança(s)
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[var(--surface-elevated)]">
                    <div className="h-2 rounded-full bg-[var(--accent-primary)]/80" style={{ width }} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {item.count > 0
                      ? `${formatCurrency(item.totalCents)} em atraso nessa faixa`
                      : "Nenhuma cobrança nessa faixa no momento"}
                  </p>
                </button>
              );
            })}
            {selectedBand ? (
              <button
                type="button"
                className={appSelectionPillClasses(false)}
                onClick={() => onBandChange(null)}
              >
                Limpar faixa
              </button>
            ) : null}
          </div>
        </AppSectionBlock>

        <AppSectionBlock
          title="Concentração do vencido"
          subtitle="Clientes que concentram maior recuperação imediata."
          compact
          className="border-[var(--border-subtle)]"
        >
          <div className="space-y-3">
            {topImpact.map(item => {
              const isActive = selectedCustomer === item.customerId;
              const ratio = topImpactTotal > 0 ? (item.totalCents / topImpactTotal) * 100 : 0;
              return (
                <button
                  key={item.customerId}
                  type="button"
                  onClick={() => onCustomerChange(isActive ? null : item.customerId)}
                  className={cn(
                    "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/35 p-3 text-left transition hover:border-[var(--border-emphasis)] hover:bg-[var(--surface-base)]/55",
                    isActive && "border-[var(--border-emphasis)] bg-[var(--surface-base)]/55"
                  )}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2 text-sm">
                    <p className="truncate font-medium text-[var(--text-primary)]">{item.customerName}</p>
                    <p className="shrink-0 font-semibold text-[var(--text-primary)]">{formatCurrency(item.totalCents)}</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{item.chargesCount} título(s) vencido(s)</p>
                  <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-elevated)]">
                    <div className="h-1.5 rounded-full bg-[var(--accent-primary)]/80" style={{ width: `${Math.max(ratio, 8)}%` }} />
                  </div>
                </button>
              );
            })}
            {topImpact.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border-subtle)] p-4 text-xs text-[var(--text-muted)]">
                Ainda sem concentração relevante por cliente.
              </div>
            ) : null}
          </div>
        </AppSectionBlock>
      </div>

      <AppSectionBlock
        title="Lista de recuperação"
        subtitle="Ação por linha com prioridade explícita de cobrança."
        compact
        className="border-[var(--border-subtle)]"
      >
        {focusDescription ? (
          <p className="mb-3 text-xs text-[var(--text-secondary)]">Filtro ativo: {focusDescription}.</p>
        ) : null}
        <AppDataTable>
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
              <tr>
                <th className="p-2.5 text-left">Cliente</th>
                <th className="text-left">Dias em atraso</th>
                <th className="text-left">Valor</th>
                <th className="text-left">Vencimento</th>
                <th className="text-left">Prioridade</th>
                <th className="p-2.5 text-left">Ação principal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(charge => {
                const days = getDaysOverdue(charge?.dueDate);
                const priority = days > 15 ? "Máxima" : days > 7 ? "Alta" : "Média";
                return (
                  <tr
                    key={String(charge?.id)}
                    className="border-t border-[var(--border-subtle)] bg-[var(--surface-base)]/20"
                  >
                    <td className="min-w-0 p-2.5">
                      <span className="block truncate">{String(charge?.customer?.name ?? "—")}</span>
                    </td>
                    <td className="font-semibold text-[var(--text-primary)]">{days} dias</td>
                    <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                    <td>
                      {charge?.dueDate
                        ? new Date(String(charge.dueDate)).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="text-xs text-[var(--text-secondary)]">{priority}</td>
                    <td className="space-y-1.5 p-2.5">
                      <AppStatusBadge label="Vencida" />
                      <ActionFeedbackButton
                        state="idle"
                        idleLabel="Cobrar agora"
                        onClick={() => onCharge(charge)}
                      />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr className="border-t border-[var(--border-subtle)]">
                  <td colSpan={6} className="p-4 text-center text-xs text-[var(--text-muted)]">
                    Nenhuma cobrança para os filtros selecionados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </AppDataTable>
      </AppSectionBlock>
    </div>
  );
}
