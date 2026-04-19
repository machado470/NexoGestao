import {
  AppDataTable,
  AppPageEmptyState,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

interface FinancePaidProps {
  charges: any[];
  formatCurrency: (cents: number) => string;
}

export function FinancePaid({ charges, formatCurrency }: FinancePaidProps) {
  const sorted = [...charges].sort((a, b) => {
    const aPaid = a?.paidAt ? new Date(String(a.paidAt)).getTime() : 0;
    const bPaid = b?.paidAt ? new Date(String(b.paidAt)).getTime() : 0;
    return bPaid - aPaid;
  });
  const onTimeCount = sorted.filter(charge => {
    if (!charge?.paidAt || !charge?.dueDate) return false;
    return (
      new Date(String(charge.paidAt)).getTime() <=
      new Date(String(charge.dueDate)).getTime()
    );
  }).length;
  const avgDaysToPay = sorted.length
    ? Math.round(
        sorted.reduce((acc, charge) => {
          if (!charge?.paidAt || !charge?.dueDate) return acc;
          const delta =
            new Date(String(charge.paidAt)).getTime() -
            new Date(String(charge.dueDate)).getTime();
          return acc + Math.max(Math.floor(delta / (1000 * 60 * 60 * 24)), 0);
        }, 0) / sorted.length
      )
    : 0;

  if (charges.length === 0) {
    return (
      <AppPageEmptyState
        title="Sem histórico de pagamentos"
        description="Pagamentos confirmados aparecerão aqui."
      />
    );
  }

  return (
    <AppSectionBlock
      title="Histórico de recebimentos"
      subtitle="Recebimentos confirmados com contexto de pagamento."
      className="border-emerald-500/20 bg-emerald-500/5"
      compact
    >
      <div className="mb-3 grid gap-2.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-2.5 md:grid-cols-3">
        <div>
          <p className="text-[11px] text-emerald-200/90">Pagas em dia</p>
          <p className="text-sm font-semibold text-emerald-100">
            {onTimeCount} de {sorted.length}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-emerald-200/90">Média de atraso</p>
          <p className="text-sm font-semibold text-emerald-100">
            {avgDaysToPay} dia(s)
          </p>
        </div>
        <div>
          <p className="text-[11px] text-emerald-200/90">Métodos</p>
          <p className="text-sm font-medium text-emerald-100">
            PIX, boleto e cartão
          </p>
        </div>
      </div>
      <AppDataTable>
        <table className="w-full text-sm">
          <thead className="bg-emerald-500/10 text-xs text-emerald-100">
            <tr>
              <th className="p-2.5 text-left">Cliente</th>
              <th className="text-left">Valor</th>
              <th className="text-left">Pago em</th>
              <th className="text-left">Condição</th>
              <th className="p-2.5 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(charge => (
              <tr
                key={String(charge?.id)}
                className="border-t border-emerald-300/40"
              >
                <td className="p-2.5">
                  {String(charge?.customer?.name ?? "—")}
                </td>
                <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                <td>
                  {charge?.paidAt
                    ? new Date(String(charge.paidAt)).toLocaleDateString(
                        "pt-BR"
                      )
                    : "—"}
                </td>
                <td className="text-xs text-[var(--text-secondary)]">
                  {charge?.paidAt && charge?.dueDate
                    ? new Date(String(charge.paidAt)).getTime() <=
                      new Date(String(charge.dueDate)).getTime()
                      ? "Pago em dia"
                      : "Pago com atraso"
                    : "Sem comparação"}
                </td>
                <td className="p-2.5">
                  <AppStatusBadge label="Pago" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AppDataTable>
    </AppSectionBlock>
  );
}
