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
    const map = new Map<string, number>();
    sorted.forEach(item => {
      const label = getBand(getDaysOverdue(item?.dueDate));
      map.set(label, (map.get(label) ?? 0) + 1);
    });
    return ["Até 3 dias", "4 a 7 dias", "8 a 15 dias", "+ de 15 dias"].map(label => ({
      label,
      value: map.get(label) ?? 0,
    }));
  }, [sorted]);

  const topImpact = sorted.slice(0, 4);

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
        className="border-rose-500/30 bg-rose-500/10"
      >
        <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-rose-400/35 bg-rose-500/15 p-4">
              <p className="text-xs text-rose-100/80">Total vencido</p>
              <p className="mt-1 text-2xl font-semibold text-rose-100">{formatCurrency(riskTotal)}</p>
            </div>
            <div className="rounded-xl border border-rose-400/35 bg-rose-500/15 p-4">
              <p className="text-xs text-rose-100/80">Quantidade vencida</p>
              <p className="mt-1 text-2xl font-semibold text-rose-100">{sorted.length}</p>
            </div>
            <div className="rounded-xl border border-rose-400/35 bg-rose-500/15 p-4">
              <p className="text-xs text-rose-100/80">Maior atraso</p>
              <p className="mt-1 text-2xl font-semibold text-rose-100">{maxDaysOverdue}d</p>
            </div>
            <div className="rounded-xl border border-rose-400/35 bg-rose-500/15 p-4">
              <p className="text-xs text-rose-100/80">Impacto no caixa</p>
              <p className="mt-1 text-2xl font-semibold text-rose-100">
                {riskTotal > 0 ? `${Math.min(Math.round((riskTotal / 5000000) * 100), 100)}%` : "0%"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-rose-400/40 bg-rose-500/20 p-4">
            <p className="text-sm font-semibold text-rose-100">O que cobrar primeiro</p>
            <p className="mt-1 text-xs text-rose-100/80">
              Comece por cobranças acima da média de atraso ({averageOverdue} dias) e maior valor.
            </p>
            <ActionFeedbackButton
              state="idle"
              idleLabel="Cobrar prioridade agora"
              onClick={() => onCharge(sorted[0])}
            />
          </div>
        </div>
      </AppSectionBlock>

      <div className="grid gap-4 xl:grid-cols-2">
        <AppSectionBlock
          title="Faixas de atraso"
          subtitle="Visual de criticidade para conduzir a rotina de cobrança."
          compact
          className="border-rose-500/25"
        >
          <ChartContainer className="h-[220px] w-full" config={{ value: { label: "Cobranças" } }}>
            <BarChart data={bucketData}>
              <CartesianGrid vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={[8, 8, 4, 4]} fill="#fb7185" />
            </BarChart>
          </ChartContainer>
        </AppSectionBlock>

        <AppSectionBlock
          title="Concentração do vencido"
          subtitle="Clientes que concentram maior recuperação imediata."
          compact
          className="border-rose-500/25"
        >
          <div className="space-y-3">
            {topImpact.map(item => {
              const value = Number(item?.amountCents ?? 0);
              const ratio = riskTotal > 0 ? (value / riskTotal) * 100 : 0;
              return (
                <div key={String(item?.id)} className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium text-rose-100">{String(item?.customer?.name ?? "Sem cliente")}</p>
                    <p className="font-semibold text-rose-100">{formatCurrency(value)}</p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-rose-950/40">
                    <div className="h-1.5 rounded-full bg-rose-300" style={{ width: `${Math.max(ratio, 8)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </AppSectionBlock>
      </div>

      <AppSectionBlock
        title="Lista de recuperação"
        subtitle="Ação por linha com prioridade explícita de cobrança."
        compact
        className="border-rose-500/25"
      >
        <AppDataTable>
          <table className="w-full text-sm">
            <thead className="bg-rose-500/10 text-xs text-rose-100">
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
              {sorted.map(charge => {
                const days = getDaysOverdue(charge?.dueDate);
                const priority = days > 15 ? "Máxima" : days > 7 ? "Alta" : "Média";
                return (
                  <tr
                    key={String(charge?.id)}
                    className="border-t border-rose-300/30 bg-rose-500/5"
                  >
                    <td className="p-2.5">{String(charge?.customer?.name ?? "—")}</td>
                    <td className="font-semibold text-rose-200">{days} dias</td>
                    <td>{formatCurrency(Number(charge?.amountCents ?? 0))}</td>
                    <td>
                      {charge?.dueDate
                        ? new Date(String(charge.dueDate)).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="text-xs text-rose-100/90">{priority}</td>
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
            </tbody>
          </table>
        </AppDataTable>
      </AppSectionBlock>
    </div>
  );
}
