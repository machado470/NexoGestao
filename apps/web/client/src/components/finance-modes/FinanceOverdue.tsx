import {
  AppDataTable,
  AppPageEmptyState,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
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

export function FinanceOverdue({
  charges,
  formatCurrency,
  onCharge,
}: FinanceOverdueProps) {
  const sorted = [...charges].sort(
    (a, b) => getDaysOverdue(b?.dueDate) - getDaysOverdue(a?.dueDate)
  );
  const riskTotal = sorted.reduce(
    (acc, charge) => acc + Number(charge?.amountCents ?? 0),
    0
  );
  const maxDaysOverdue = sorted[0] ? getDaysOverdue(sorted[0]?.dueDate) : 0;

  if (sorted.length === 0) {
    return (
      <AppPageEmptyState
        title="Sem cobranças vencidas"
        description="Excelente: não há risco crítico aberto."
      />
    );
  }

  return (
    <AppSectionBlock
      title="Crítico: cobranças vencidas"
      subtitle="Urgência financeira com foco em recuperação."
      className="border-rose-500/25 bg-rose-500/8"
      compact
    >
      <div className="mb-3 grid gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 md:grid-cols-3 md:items-center">
        <div>
          <p className="text-[11px] text-rose-200/90">Valor em risco</p>
          <p className="text-base font-semibold text-rose-100">
            {formatCurrency(riskTotal)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-rose-200/90">Maior atraso</p>
          <p className="text-sm font-semibold text-rose-100">
            {maxDaysOverdue} dias
          </p>
        </div>
        <div className="md:justify-self-end">
          <ActionFeedbackButton
            state="idle"
            idleLabel="Cobrar agora"
            onClick={() => onCharge()}
          />
        </div>
      </div>

      <AppDataTable>
        <table className="w-full text-sm">
          <thead className="bg-rose-500/10 text-xs text-rose-100">
            <tr>
              <th className="p-2.5 text-left">Cliente</th>
              <th className="text-left">Dias atraso</th>
              <th className="text-left">Valor</th>
              <th className="text-left">Vencimento</th>
              <th className="p-2.5 text-left">Ação principal</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(charge => (
              <tr
                key={String(charge?.id)}
                className="border-t border-rose-300/30 bg-rose-500/5"
              >
                <td className="p-2.5">
                  {String(charge?.customer?.name ?? "—")}
                </td>
                <td className="font-semibold text-rose-200">
                  {getDaysOverdue(charge?.dueDate)} dias
                </td>
                <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                <td>
                  {charge?.dueDate
                    ? new Date(String(charge.dueDate)).toLocaleDateString(
                        "pt-BR"
                      )
                    : "—"}
                </td>
                <td className="space-y-1.5 p-2.5">
                  <AppStatusBadge label="Atrasado" />
                  <ActionFeedbackButton
                    state="idle"
                    idleLabel="Cobrar agora"
                    onClick={() => onCharge(charge)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AppDataTable>
    </AppSectionBlock>
  );
}
