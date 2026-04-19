import { AppDataTable, AppPageEmptyState, AppSectionBlock, AppStatusBadge } from "@/components/internal-page-system";

interface FinancePaidProps {
  charges: any[];
  formatCurrency: (cents: number) => string;
}

export function FinancePaid({ charges, formatCurrency }: FinancePaidProps) {
  if (charges.length === 0) {
    return <AppPageEmptyState title="Sem histórico de pagamentos" description="Pagamentos confirmados aparecerão aqui." />;
  }

  return (
    <AppSectionBlock title="Histórico de recebimentos" subtitle="Modo histórico: lista simples, sem ações agressivas." className="border-emerald-500/20 bg-emerald-500/5">
      <AppDataTable>
        <table className="w-full text-sm">
          <thead className="bg-emerald-500/10 text-xs text-emerald-900">
            <tr>
              <th className="p-3 text-left">Cliente</th>
              <th className="text-left">Valor</th>
              <th className="text-left">Pago em</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((charge) => (
              <tr key={String(charge?.id)} className="border-t border-emerald-300/40">
                <td className="p-3">{String(charge?.customer?.name ?? "—")}</td>
                <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                <td>{charge?.paidAt ? new Date(String(charge.paidAt)).toLocaleDateString("pt-BR") : "—"}</td>
                <td className="p-3"><AppStatusBadge label="Pago" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </AppDataTable>
    </AppSectionBlock>
  );
}
