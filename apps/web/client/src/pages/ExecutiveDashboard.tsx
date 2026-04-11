import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
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

const chartData = [
  { day: "Seg", receita: 42, ordens: 18 },
  { day: "Ter", receita: 38, ordens: 16 },
  { day: "Qua", receita: 47, ordens: 21 },
  { day: "Qui", receita: 51, ordens: 24 },
  { day: "Sex", receita: 58, ordens: 27 },
  { day: "Sáb", receita: 36, ordens: 14 },
];

export default function ExecutiveDashboard() {
  return (
    <AppPageShell>
      <AppPageHeader
        title="Centro de decisão operacional"
        description="Visão executiva do fluxo Cliente → Agendamento → O.S. → Cobrança → Pagamento."
        ctaLabel="Executar próxima ação"
      />

      <AppKpiRow
        items={[
          { label: "Receita", value: "R$ 187,4k", trend: 15.6, context: "vs mês anterior" },
          { label: "Ordens", value: "124", trend: -3.2, context: "vs semana passada" },
          { label: "SLA", value: "92,8%", trend: 2.1, context: "últimos 30 dias" },
          { label: "Ticket médio", value: "R$ 1.511", trend: 4.4, context: "vs mês anterior" },
        ]}
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel title="Evolução de receita e volume" description="Ritmo operacional diário com impacto em faturamento.">
          <ChartContainer
            className="h-[260px] w-full"
            config={{ receita: { label: "Receita" }, ordens: { label: "Ordens" } }}
          >
            <AreaChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="receita" stroke="var(--brand-primary)" fill="var(--brand-primary)" fillOpacity={0.25} />
              <Area type="monotone" dataKey="ordens" stroke="var(--color-info)" fill="var(--color-info)" fillOpacity={0.1} />
            </AreaChart>
          </ChartContainer>
        </AppChartPanel>

        <AppSectionBlock title="Itens que exigem atenção" subtitle="Prioridades do dia">
          <AppAlertList alerts={[{ text: "5 O.S. atrasadas aguardando execução", tone: "danger" }, { text: "12 cobranças vencidas sem negociação", tone: "warning" }, { text: "2 clientes sem retorno há 7 dias", tone: "warning" }]} />
        </AppSectionBlock>

        <AppSectionBlock title="Atividade recente" subtitle="Atualizações em tempo real">
          <AppRecentActivity items={["O.S. #1847 concluída há 3 min", "Pagamento recebido há 8 min", "Novo agendamento criado há 14 min", "Mensagem enviada ao cliente há 20 min"]} />
        </AppSectionBlock>
      </div>

      <AppSectionBlock title="Ordens críticas" subtitle="Foco operacional dominante">
        <AppListBlock
          items={[
            { title: "O.S. #1851 · Instalação comercial", subtitle: "Cliente Atlas · Prazo hoje 17:00", right: <AppStatusBadge label="Urgente" /> },
            { title: "O.S. #1849 · Manutenção preventiva", subtitle: "Equipe Norte · 2h de atraso", right: <AppStatusBadge label="Atrasado" /> },
            { title: "O.S. #1844 · Retorno técnico", subtitle: "Risco de multa contratual", right: <AppStatusBadge label="Em risco" /> },
          ]}
        />
      </AppSectionBlock>
    </AppPageShell>
  );
}
