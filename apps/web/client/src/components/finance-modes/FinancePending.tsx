import {
  AppPageEmptyState,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { AppDataTable } from "@/components/internal-page-system";

interface FinancePendingProps {
  charges: any[];
  onRemind: (charge?: any) => void;
  formatCurrency: (cents: number) => string;
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
    const dueDate = charge?.dueDate ? new Date(String(charge.dueDate)) : null;
    if (!dueDate) return false;
    const delta = dueDate.getTime() - Date.now();
    return delta >= 0 && delta <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  if (charges.length === 0) {
    return (
      <AppPageEmptyState
        title="Sem cobranças pendentes"
        description="Sua operação está em dia neste momento."
      />
    );
  }

  return (
    <div className="space-y-3">
      <AppSectionBlock
        title="Pendentes"
        subtitle="Execução de lembretes e acompanhamento."
        compact
      >
        <div className="mb-3 grid gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)]/55 p-2.5 md:grid-cols-3 md:items-center">
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Total pendente
            </p>
            <p className="text-base font-semibold text-[var(--text-primary)]">
              {formatCurrency(pendingTotal)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Vencem em 7 dias
            </p>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {dueSoon} cobrança(s)
            </p>
          </div>
          <div className="md:justify-self-end">
            <ActionFeedbackButton
              state="idle"
              idleLabel="Lembrar em lote"
              onClick={() => onRemind()}
            />
          </div>
        </div>
        <AppDataTable>
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
              <tr>
                <th className="p-2.5 text-left">Cliente</th>
                <th className="text-left">Valor</th>
                <th className="text-left">Vencimento</th>
                <th className="text-left">Status</th>
                <th className="p-2.5 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {charges.map(charge => (
                <tr
                  key={String(charge?.id)}
                  className="border-t border-[var(--border-subtle)]"
                >
                  <td className="p-2.5">
                    {String(charge?.customer?.name ?? "—")}
                  </td>
                  <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                  <td>
                    {charge?.dueDate
                      ? new Date(String(charge.dueDate)).toLocaleDateString(
                          "pt-BR"
                        )
                      : "—"}
                  </td>
                  <td>
                    <AppStatusBadge label="Pendente" />
                  </td>
                  <td className="p-2.5">
                    <ActionFeedbackButton
                      state="idle"
                      idleLabel="Lembrar"
                      onClick={() => onRemind(charge)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AppDataTable>
      </AppSectionBlock>
    </div>
  );
}
