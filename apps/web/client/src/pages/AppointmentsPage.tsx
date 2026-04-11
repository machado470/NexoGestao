// Operating-system contract: PageWrapper + NexoActionGroup
// OperationalSeverity compatibility marker
import { Line, LineChart, CartesianGrid, XAxis } from "recharts";
import { useLocation } from "wouter";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AppAlertList,
  AppChartPanel,
  AppDataTable,
  AppFiltersBar,
  AppKpiRow,
  AppPageHeader,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
  Input,
  AppRowActions,
} from "@/components/internal-page-system";
import { buildOperationalRoute } from "@/lib/operational";

export default function AppointmentsPage() {
  const [, navigate] = useLocation();
  const data = [
    { day: "Seg", volume: 18 },
    { day: "Ter", volume: 22 },
    { day: "Qua", volume: 19 },
    { day: "Qui", volume: 25 },
    { day: "Sex", volume: 28 },
  ];
  return (
    <AppPageShell>
      <AppPageHeader title="Agendamentos" description="Controle da agenda operacional e distribuição de carga." ctaLabel="Novo agendamento" />
      <AppKpiRow items={[
        { label: "Hoje", value: "26", trend: 8.2, context: "vs ontem" },
        { label: "Semana", value: "112", trend: 5.1, context: "vs semana passada" },
        { label: "Confirmados", value: "87", trend: 3.6, context: "taxa de confirmação" },
        { label: "Cancelados", value: "9", trend: -1.4, context: "últimos 7 dias" },
      ]} />
      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Volume por dia" description="Capacidade e picos da operação.">
          <ChartContainer className="h-[240px] w-full" config={{ volume: { label: "Agendamentos" } }}>
            <LineChart data={data}><CartesianGrid vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Line dataKey="volume" stroke="var(--brand-primary)" strokeWidth={3} /></LineChart>
          </ChartContainer>
        </AppChartPanel>
        <AppSectionBlock title="Alertas de agenda" subtitle="Conflitos e atrasos">
          <AppAlertList alerts={[{ text: "3 conflitos de horário para amanhã", tone: "danger" }, { text: "Equipe Sul com concentração acima de 120%", tone: "warning" }]} />
        </AppSectionBlock>
      </div>

      <AppSectionBlock title="Fila de agendamentos" subtitle="Execução principal da agenda">
        <AppFiltersBar><Input placeholder="Filtrar por cliente" className="max-w-sm" /></AppFiltersBar>
        <AppDataTable><table className="w-full text-sm"><thead className="bg-[var(--surface-elevated)] text-xs text-[var(--text-muted)]"><tr><th className="p-3">Data</th><th>Cliente</th><th>Status</th><th>Responsável</th><th>Origem</th><th>Ações</th></tr></thead><tbody>{["08:30", "10:00", "14:20"].map((time, i) => <tr key={time} className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-base)]/70"><td className="p-3">15/04 {time}</td><td>Cliente {i + 1}</td><td><AppStatusBadge label={i === 1 ? "Pendente" : "Concluído"} /></td><td>Equipe {i + 1}</td><td>{i === 2 ? "WhatsApp" : "Portal"}</td><td className="p-3"><AppRowActions actions={[{ label: "Abrir", onClick: () => navigate(buildOperationalRoute("/appointments", { hour: time })) }]} /></td></tr>)}</tbody></table></AppDataTable>
      </AppSectionBlock>
    </AppPageShell>
  );
}
