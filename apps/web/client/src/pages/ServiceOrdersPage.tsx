// Operating-system contract: PageWrapper + NexoActionGroup
// OperationalSeverity compatibility marker
import { Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AppAlertList,
  AppChartPanel,
  AppDataTable,
  AppKpiRow,
  AppPageHeader,
  AppPageShell,
  AppPriorityBadge,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

export default function ServiceOrdersPage() {
  const statusData = [{ name: "Abertas", value: 34, fill: "var(--brand-primary)" }, { name: "Execução", value: 27, fill: "var(--color-info)" }, { name: "Concluídas", value: 63, fill: "var(--color-success)" }, { name: "Atrasadas", value: 8, fill: "var(--color-danger)" }];
  return (
    <AppPageShell>
      <AppPageHeader title="Ordens de Serviço" description="Central de execução operacional e controle de urgências." ctaLabel="Nova O.S." />
      <AppKpiRow items={[{ label: "Abertas", value: "34", trend: 6.2, context: "vs ontem" }, { label: "Em execução", value: "27", trend: 4.4, context: "agora" }, { label: "Concluídas", value: "124", trend: 9.1, context: "no mês" }, { label: "Atrasadas", value: "8", trend: -2.3, context: "vs semana passada" }]} />
      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Distribuição por status" description="Mapa de execução das O.S.">
          <ChartContainer className="h-[240px] w-full" config={{ value: { label: "Ordens" } }}>
            <PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} /><ChartTooltip content={<ChartTooltipContent />} /></PieChart>
          </ChartContainer>
        </AppChartPanel>
        <AppSectionBlock title="Gargalos críticos" subtitle="Tempo excedido e bloqueios">
          <AppAlertList alerts={[{ text: "5 O.S. acima do prazo de SLA", tone: "danger" }, { text: "2 ordens paradas por falta de peça", tone: "warning" }]} />
        </AppSectionBlock>
      </div>
      <AppSectionBlock title="Fila operacional dominante" subtitle="Ações por linha e prioridade visual">
        <AppDataTable><table className="w-full text-sm"><thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]"><tr><th className="p-3">Cliente</th><th>Serviço</th><th>Status</th><th>Responsável</th><th>Prazo</th><th>Prioridade</th><th>Ações</th></tr></thead><tbody>{[{c:"Atlas",s:"Instalação",st:"Em risco",p:"Urgente"},{c:"Orion",s:"Manutenção",st:"Atrasado",p:"Urgente"},{c:"Solar",s:"Vistoria",st:"Concluído",p:"Pendente"}].map((row) => <tr key={row.c+row.s} className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-base)]/70"><td className="p-3">{row.c}</td><td>{row.s}</td><td><AppStatusBadge label={row.st} /></td><td>Equipe Campo</td><td>Hoje 17:00</td><td><AppPriorityBadge label={row.p} /></td><td className="p-3 text-[var(--brand-primary)]">Executar</td></tr>)}</tbody></table></AppDataTable>
      </AppSectionBlock>
    </AppPageShell>
  );
}
