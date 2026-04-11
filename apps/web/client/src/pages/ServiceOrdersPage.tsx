// Operating-system contract: PageWrapper + NexoActionGroup
// OperationalSeverity compatibility marker
import { Pie, PieChart } from "recharts";
import { useLocation } from "wouter";
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
  AppRowActions,
} from "@/components/internal-page-system";
import { AppNextActions } from "@/components/app";
import { buildOperationalRoute } from "@/lib/operational";

export default function ServiceOrdersPage() {
  const [, navigate] = useLocation();
  const statusData = [{ name: "Abertas", value: 34, fill: "var(--brand-primary)" }, { name: "Execução", value: 27, fill: "var(--color-info)" }, { name: "Concluídas", value: 63, fill: "var(--color-success)" }, { name: "Atrasadas", value: 8, fill: "var(--color-danger)" }];
  return (
    <AppPageShell>
      <AppPageHeader title="Ordens de Serviço" description="Saiba quais serviços estão atrasados, em risco e o que concluir primeiro." ctaLabel="Criar nova O.S. agora" />
      <AppNextActions
        title="Você precisa fazer isso agora"
        engineInput={{
          customers: [{ id: "c-atlas", name: "Atlas", phone: "5511988881200" }],
          charges: [],
          appointments: [],
          serviceOrders: [
            { id: "so-1", customerId: "c-atlas", status: "OVERDUE", delayedMinutes: 360 },
            { id: "so-2", customerId: "c-atlas", status: "AT_RISK", delayedMinutes: 120 },
          ],
        }}
      />
      <AppKpiRow items={[{ label: "Abertas", value: "34", trend: 6.2, context: "vs ontem" }, { label: "Em execução", value: "27", trend: 4.4, context: "agora" }, { label: "Concluídas", value: "124", trend: 9.1, context: "no mês" }, { label: "Atrasadas", value: "8", trend: -2.3, context: "vs semana passada" }]} />
      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Distribuição por status" description="Mapa de execução das O.S.">
          <ChartContainer className="h-[240px] w-full" config={{ value: { label: "Ordens" } }}>
            <PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} /><ChartTooltip content={<ChartTooltipContent />} /></PieChart>
          </ChartContainer>
        </AppChartPanel>
        <AppSectionBlock title="Gargalos críticos" subtitle="Serviços travados que atrasam a entrega ao cliente">
          <AppAlertList alerts={[{ text: "5 O.S. acima do prazo de SLA", tone: "danger" }, { text: "2 ordens paradas por falta de peça", tone: "warning" }]} />
        </AppSectionBlock>
      </div>
      <AppSectionBlock title="Fila operacional dominante" subtitle="Cada linha mostra prioridade, impacto e próxima ação clara">
        <AppDataTable><table className="w-full text-sm"><thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]"><tr><th className="p-3">Cliente</th><th>Serviço</th><th>Status</th><th>Responsável</th><th>Prazo</th><th>Prioridade</th><th>Ações</th></tr></thead><tbody>{[{c:"Atlas",s:"Instalação",st:"Em risco",p:"Alta"},{c:"Orion",s:"Manutenção",st:"Atrasado",p:"Alta"},{c:"Solar",s:"Vistoria",st:"Concluído",p:"Baixa"}].map((row) => <tr key={row.c+row.s} className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-base)]/70"><td className="p-3">{row.c}</td><td>{row.s}</td><td><AppStatusBadge label={row.st} /></td><td>Equipe Campo</td><td>Hoje 17:00</td><td><AppPriorityBadge label={row.p} /></td><td className="p-3"><AppRowActions actions={[{ label: row.st === "Concluído" ? "Ver detalhes da O.S." : "Concluir serviço agora", onClick: () => navigate(buildOperationalRoute("/service-orders", { customer: row.c })) }]} /></td></tr>)}</tbody></table></AppDataTable>
      </AppSectionBlock>
    </AppPageShell>
  );
}
