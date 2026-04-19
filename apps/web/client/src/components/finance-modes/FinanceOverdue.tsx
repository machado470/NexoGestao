import { AppDataTable, AppPageEmptyState, AppSectionBlock, AppStatusBadge } from "@/components/internal-page-system";
import { ActionFeedbackButton } from "@/components/operating-system/ActionFeedbackButton";

interface FinanceOverdueProps {
  charges: any[];
  formatCurrency: (cents: number) => string;
  onCharge: (charge?: any) => void;
}

function getDaysOverdue(dueDate: unknown) {
  if (!dueDate) return 0;
  const due = new Date(String(dueDate));
  const delta = Date.now() - due.getTime();
  return Math.max(Math.floor(delta / (1000 * 60 * 60 * 24)), 0);
}

export function FinanceOverdue({ charges, formatCurrency, onCharge }: FinanceOverdueProps) {
  const sorted = [...charges].sort((a, b) => getDaysOverdue(b?.dueDate) - getDaysOverdue(a?.dueDate));

  if (sorted.length === 0) {
    return <AppPageEmptyState title="Sem cobranças vencidas" description="Excelente: não há risco crítico aberto." />;
  }

  return (
    <AppSectionBlock
      title="Crítico: cobranças vencidas"
      subtitle="Lista ordenada por dias em atraso com foco em ação imediata."
      className="border-rose-500/30 bg-rose-500/10"
    >
      <div className="mb-3 flex justify-end">
        <ActionFeedbackButton state="idle" idleLabel="Cobrar agora" onClick={() => onCharge()} />
      </div>

      <AppDataTable>
        <table className="w-full text-sm">
          <thead className="bg-rose-500/10 text-xs text-rose-900">
            <tr>
              <th className="p-3 text-left">Cliente</th>
              <th className="text-left">Dias atraso</th>
              <th className="text-left">Valor</th>
              <th className="text-left">Vencimento</th>
              <th className="p-3 text-left">Ação principal</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((charge) => (
              <tr key={String(charge?.id)} className="border-t border-rose-300/40 bg-rose-500/5">
                <td className="p-3">{String(charge?.customer?.name ?? "—")}</td>
                <td className="font-semibold text-rose-700">{getDaysOverdue(charge?.dueDate)} dias</td>
                <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                <td>{charge?.dueDate ? new Date(String(charge.dueDate)).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="p-3 space-y-2">
                  <AppStatusBadge label="Atrasado" />
                  <ActionFeedbackButton state="idle" idleLabel="Cobrar agora" onClick={() => onCharge(charge)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AppDataTable>
    </AppSectionBlock>
  );
}
