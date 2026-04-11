// Operating-system contract: PageWrapper + NexoActionGroup
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { useLocation } from "wouter";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";
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
  const [, navigate] = useLocation();
  const { runAction, isRunning } = useRunAction();
  const events = [{ t: "08h", total: 26 }, { t: "10h", total: 34 }, { t: "12h", total: 18 }, { t: "14h", total: 39 }, { t: "16h", total: 28 }];

  return (
    <AppPageShell>
      <AppPageHeader title="Timeline Auditável" description="Histórico operacional com rastreabilidade por entidade e usuário." />
      <AppKpiRow items={[{ label: "Eventos hoje", value: "214", trend: 7.4, context: "+16 hoje · vs ontem", onClick: () => navigate("/timeline?period=today") }, { label: "Eventos críticos", value: "12", trend: -2.2, context: "-1 hoje · últimas 24h", onClick: () => navigate("/timeline?severity=critical&period=24h") }, { label: "Entidades auditadas", value: "97", trend: 3.1, context: "+3 na semana · base ativa", onClick: () => navigate("/timeline?groupBy=entity&period=7d") }, { label: "Usuários ativos", value: "18", trend: 4.6, context: "↑ uso · período atual", onClick: () => navigate("/timeline?groupBy=user&period=7d") }]} />
      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Volume de eventos por hora" description="Padrão de atividade e auditoria." trendValue={7.1} trendLabel="↑ +7,1% · últimas 24h" onCtaClick={() => navigate("/timeline?chart=events_by_hour&period=24h")}>
          <ChartContainer className="h-[220px] w-full" config={{ total: { label: "Eventos" } }}><BarChart data={events}><CartesianGrid vertical={false} /><XAxis dataKey="t" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="total" fill="var(--brand-primary)" /></BarChart></ChartContainer>
        </AppChartPanel>
      </div>
      <AppSectionBlock title="Feed de eventos" subtitle="Leitura clara para auditoria">
        <AppFiltersBar><Input placeholder="Filtrar por entidade, tipo, usuário ou período" className="max-w-md" /></AppFiltersBar>
        <AppListBlock items={[{ title: "[Cobrança] Status alterado para Pago", subtitle: "Cliente Atlas · por Mariana · 16:12", action: <Button size="sm" onClick={() => void runAction(async () => navigate("/finances?status=paid&customer=atlas"))} isLoading={isRunning}>Abrir</Button> }, { title: "[O.S.] #1849 marcada como atrasada", subtitle: "Responsável Equipe Norte · 15:58", action: <Button size="sm" onClick={() => void runAction(async () => navigate("/whatsapp?os=1849&context=delay"))} isLoading={isRunning}>Cobrar cliente</Button> }, { title: "[Agendamento] novo horário confirmado", subtitle: "Cliente Solar Prime · 15:44", action: <Button size="sm" onClick={() => void runAction(async () => navigate("/appointments?customer=solar-prime"))} isLoading={isRunning}>Editar</Button> }, { title: "[Governança] nível elevado para WARNING", subtitle: "Regra: inadimplência + SLA · 15:30", action: <Button size="sm" onClick={() => void runAction(async () => navigate("/governance?severity=warning"))} isLoading={isRunning}>Avançar status</Button> }]} />
      </AppSectionBlock>
    </AppPageShell>
  );
}
