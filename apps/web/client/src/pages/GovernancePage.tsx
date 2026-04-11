// Operating-system contract: PageWrapper + NexoActionGroup
import { Line, LineChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AppAlertList,
  AppChartPanel,
  AppKpiRow,
  AppListBlock,
  AppPageHeader,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

export default function GovernancePage() {
  const risk = [{ d: "D-6", score: 42 }, { d: "D-5", score: 44 }, { d: "D-4", score: 48 }, { d: "D-3", score: 53 }, { d: "D-2", score: 57 }, { d: "D-1", score: 55 }];
  return (
    <AppPageShell>
      <AppPageHeader title="Governança e Risco" description="Saúde operacional, desvios e ações recomendadas." />
      <AppKpiRow items={[{ label: "Risco atual", value: "55/100", trend: 3.9, context: "últimas 24h" }, { label: "Alertas ativos", value: "14", trend: 11.2, context: "monitoramento" }, { label: "Eventos críticos", value: "6", trend: -1.5, context: "hoje" }, { label: "Entidades em risco", value: "9", trend: 4.3, context: "base ativa" }]} />
      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Evolução do risco" description="Comportamento temporal de governança.">
          <ChartContainer className="h-[240px] w-full" config={{ score: { label: "Risco" } }}><LineChart data={risk}><CartesianGrid vertical={false} /><XAxis dataKey="d" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Line dataKey="score" stroke="var(--brand-primary)" strokeWidth={3} /></LineChart></ChartContainer>
        </AppChartPanel>
        <AppSectionBlock title="Problemas detectados" subtitle="Motivos de desvio">
          <AppAlertList alerts={[{ text: "SLA abaixo de 85% em 2 equipes", tone: "danger" }, { text: "Inadimplência acima de 10% em segmento comercial", tone: "warning" }, { text: "Falhas de comunicação em 3 fluxos críticos", tone: "warning" }]} />
        </AppSectionBlock>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <AppSectionBlock title="Entidades em risco" subtitle="Estados NORMAL / WARNING / RESTRICTED / SUSPENDED">
          <AppListBlock items={[{ title: "Cliente Atlas", subtitle: "Risco por atraso + cobrança vencida", right: <AppStatusBadge label="Warning" /> }, { title: "Equipe Norte", subtitle: "SLA abaixo da meta", right: <AppStatusBadge label="Restricted" /> }, { title: "Conta Aurora", subtitle: "Sem desvios críticos", right: <AppStatusBadge label="Normal" /> }]} />
        </AppSectionBlock>
        <AppSectionBlock title="Ações recomendadas" subtitle="Próximos passos de governança">
          <AppListBlock items={[{ title: "Escalar O.S. atrasadas para supervisor", subtitle: "Impacto: reduzir risco operacional imediato" }, { title: "Executar mutirão de cobrança em atraso", subtitle: "Impacto: reduzir risco financeiro" }, { title: "Reprocessar mensagens falhas", subtitle: "Impacto: restaurar comunicação crítica" }]} />
        </AppSectionBlock>
      </div>
    </AppPageShell>
  );
}
