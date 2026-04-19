import { AppPageEmptyState, AppSectionBlock, AppStatusBadge } from "@/components/internal-page-system";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";
import { AppDataTable } from "@/components/internal-page-system";

interface FinancePendingProps {
  charges: any[];
  onRemind: (charge?: any) => void;
  formatCurrency: (cents: number) => string;
}

export function FinancePending({ charges, onRemind, formatCurrency }: FinancePendingProps) {
  if (charges.length === 0) {
    return <AppPageEmptyState title="Sem cobranças pendentes" description="Sua operação está em dia neste momento." />;
  }

  return (
    <div className="space-y-4">
      <AppSectionBlock title="Pendentes" subtitle="Lista limpa para lembretes e acompanhamento sem pressão visual.">
        <div className="mb-3 flex justify-end">
          <ActionFeedbackButton state="idle" idleLabel="Lembrar" onClick={() => onRemind()} />
        </div>
        <AppDataTable>
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]">
              <tr>
                <th className="p-3 text-left">Cliente</th>
                <th className="text-left">Valor</th>
                <th className="text-left">Vencimento</th>
                <th className="text-left">Status</th>
                <th className="p-3 text-left">Ações</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => (
                <tr key={String(charge?.id)} className="border-t border-[var(--border-subtle)]">
                  <td className="p-3">{String(charge?.customer?.name ?? "—")}</td>
                  <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                  <td>{charge?.dueDate ? new Date(String(charge.dueDate)).toLocaleDateString("pt-BR") : "—"}</td>
                  <td><AppStatusBadge label="Pendente" /></td>
                  <td className="p-3">
                    <ActionFeedbackButton state="idle" idleLabel="Lembrar" onClick={() => onRemind(charge)} />
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
