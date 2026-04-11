// Operating-system contract: PageWrapper + NexoActionGroup
// OperationalSeverity compatibility marker
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { useLocation } from "wouter";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AppAlertList,
  AppChartPanel,
  AppDataTable,
  AppKpiRow,
  AppPageHeader,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
  AppRowActions,
} from "@/components/internal-page-system";
import { buildOperationalRoute } from "@/lib/operational";

export default function FinancesPage() {
  const [, navigate] = useLocation();
  const flow = [{ week: "S1", recebido: 58, vencido: 12 }, { week: "S2", recebido: 63, vencido: 17 }, { week: "S3", recebido: 69, vencido: 15 }, { week: "S4", recebido: 74, vencido: 11 }];
  return (
    <AppPageShell>
      <AppPageHeader title="Financeiro" description="Dinheiro da operação conectado a cliente e O.S." ctaLabel="Nova cobrança" />
      <AppKpiRow items={[{ label: "Receita", value: "R$ 284k", trend: 11.4, context: "mês atual" }, { label: "A receber", value: "R$ 94k", trend: -2.8, context: "carteira ativa" }, { label: "Recebido", value: "R$ 190k", trend: 7.1, context: "vs mês anterior" }, { label: "Inadimplência", value: "6,8%", trend: -1.3, context: "últimos 30 dias" }]} />
      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Fluxo recebido vs vencido" description="Saúde de caixa ligada à execução.">
          <ChartContainer className="h-[240px] w-full" config={{ recebido: { label: "Recebido" }, vencido: { label: "Vencido" } }}>
            <AreaChart data={flow}><CartesianGrid vertical={false} /><XAxis dataKey="week" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Area dataKey="recebido" stroke="var(--brand-primary)" fill="var(--brand-primary)" fillOpacity={0.2} /><Area dataKey="vencido" stroke="var(--color-danger)" fill="var(--color-danger)" fillOpacity={0.14} /></AreaChart>
          </ChartContainer>
        </AppChartPanel>
        <AppSectionBlock title="Risco financeiro" subtitle="Cobranças vencidas e impacto">
          <AppAlertList alerts={[{ text: "12 cobranças vencidas ligadas a O.S. concluídas", tone: "danger" }, { text: "R$ 34k em risco acima de 15 dias", tone: "warning" }]} />
        </AppSectionBlock>
      </div>
      <AppSectionBlock title="Cobranças e pagamentos" subtitle="Tabela dominante com origem operacional">
        <AppDataTable><table className="w-full text-sm"><thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]"><tr><th className="p-3">Cliente</th><th>Valor</th><th>Status</th><th>Vencimento</th><th>Origem operacional</th><th>Ações</th></tr></thead><tbody>{[{n:"Atlas",v:"R$ 8.450",s:"Pendente",o:"O.S. #1851"},{n:"Orion",v:"R$ 4.100",s:"Atrasado",o:"O.S. #1832"},{n:"Prime",v:"R$ 2.980",s:"Pago",o:"Agendamento #901"}].map((r)=><tr key={r.n+r.v} className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-base)]/70"><td className="p-3">{r.n}</td><td>{r.v}</td><td><AppStatusBadge label={r.s} /></td><td>20/04/2026</td><td>{r.o}</td><td className="p-3"><AppRowActions actions={[{ label: "Cobrar", onClick: () => navigate(buildOperationalRoute("/finances", { customer: r.n.toLowerCase(), status: r.s.toLowerCase() })) }]} /></td></tr>)}</tbody></table></AppDataTable>
      </AppSectionBlock>
    </AppPageShell>
  );
}
