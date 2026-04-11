// Operating-system contract: PageWrapper + NexoActionGroup
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AppChartPanel,
  AppFiltersBar,
  AppKpiRow,
  AppListBlock,
  AppPageHeader,
  AppPageShell,
  AppSectionBlock,
  Input,
} from "@/components/internal-page-system";

export default function TimelinePage() {
  const events = [{ t: "08h", total: 26 }, { t: "10h", total: 34 }, { t: "12h", total: 18 }, { t: "14h", total: 39 }, { t: "16h", total: 28 }];
  return (
    <AppPageShell>
      <AppPageHeader title="Timeline Auditável" description="Histórico operacional com rastreabilidade por entidade e usuário." />
      <AppKpiRow items={[{ label: "Eventos hoje", value: "214", trend: 7.4, context: "vs ontem" }, { label: "Eventos críticos", value: "12", trend: -2.2, context: "últimas 24h" }, { label: "Entidades auditadas", value: "97", trend: 3.1, context: "base ativa" }, { label: "Usuários ativos", value: "18", trend: 4.6, context: "no período" }]} />
      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Volume de eventos por hora" description="Padrão de atividade e auditoria.">
          <ChartContainer className="h-[220px] w-full" config={{ total: { label: "Eventos" } }}><BarChart data={events}><CartesianGrid vertical={false} /><XAxis dataKey="t" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="total" fill="var(--brand-primary)" /></BarChart></ChartContainer>
        </AppChartPanel>
      </div>
      <AppSectionBlock title="Feed de eventos" subtitle="Leitura clara para auditoria">
        <AppFiltersBar><Input placeholder="Filtrar por entidade, tipo, usuário ou período" className="max-w-md" /></AppFiltersBar>
        <AppListBlock items={[{ title: "[Cobrança] Status alterado para Pago", subtitle: "Cliente Atlas · por Mariana · 16:12" }, { title: "[O.S.] #1849 marcada como atrasada", subtitle: "Responsável Equipe Norte · 15:58" }, { title: "[Agendamento] novo horário confirmado", subtitle: "Cliente Solar Prime · 15:44" }, { title: "[Governança] nível elevado para WARNING", subtitle: "Regra: inadimplência + SLA · 15:30" }]} />
      </AppSectionBlock>
    </AppPageShell>
  );
}
