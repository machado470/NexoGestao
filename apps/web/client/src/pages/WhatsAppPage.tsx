import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  AppAlertList,
  AppChartPanel,
  AppKpiRow,
  AppListBlock,
  AppPageHeader,
  AppPageShell,
  AppRecentActivity,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

export default function WhatsAppPage() {
  const data = [{ day: "Seg", enviadas: 92, falhas: 4 }, { day: "Ter", enviadas: 106, falhas: 5 }, { day: "Qua", enviadas: 118, falhas: 3 }, { day: "Qui", enviadas: 133, falhas: 8 }, { day: "Sex", enviadas: 97, falhas: 2 }];
  return (
    <AppPageShell>
      <AppPageHeader title="WhatsApp Operacional" description="Comunicação contextual vinculada a cliente, cobrança e O.S." ctaLabel="Nova mensagem" />
      <AppKpiRow items={[{ label: "Enviadas", value: "546", trend: 6.4, context: "últimos 7 dias" }, { label: "Entregues", value: "519", trend: 5.9, context: "taxa de entrega" }, { label: "Falhas", value: "19", trend: -3.7, context: "vs semana passada" }, { label: "Taxa entrega", value: "95,0%", trend: 1.2, context: "média móvel" }]} />
      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Volume e falhas de envio" description="Saúde de comunicação operacional.">
          <ChartContainer className="h-[240px] w-full" config={{ enviadas: { label: "Enviadas" }, falhas: { label: "Falhas" } }}>
            <BarChart data={data}><CartesianGrid vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="enviadas" fill="var(--brand-primary)" /><Bar dataKey="falhas" fill="var(--color-danger)" /></BarChart>
          </ChartContainer>
        </AppChartPanel>
        <AppSectionBlock title="Falhas recentes" subtitle="Entrega e roteamento">
          <AppAlertList alerts={[{ text: "3 falhas por número inválido", tone: "warning" }, { text: "2 falhas por timeout da API", tone: "danger" }]} />
        </AppSectionBlock>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        <AppSectionBlock title="Conversas por contexto" subtitle="Lista operacional dominante">
          <AppListBlock items={[{ title: "Atlas Engenharia", subtitle: "Cobrança #218 · enviada há 5 min", right: <AppStatusBadge label="Entregue" /> }, { title: "Condomínio Orion", subtitle: "O.S. #1849 · mensagem de atraso", right: <AppStatusBadge label="Pendente" /> }, { title: "Solar Prime", subtitle: "Agendamento #443", right: <AppStatusBadge label="Falhou" /> }]} />
        </AppSectionBlock>
        <AppSectionBlock title="Atividade da comunicação" subtitle="Contexto recente">
          <AppRecentActivity items={["Template cobrança enviado há 3 min", "Confirmação de agendamento há 8 min", "Reenvio de mensagem por falha há 15 min"]} />
        </AppSectionBlock>
      </div>
    </AppPageShell>
  );
}
