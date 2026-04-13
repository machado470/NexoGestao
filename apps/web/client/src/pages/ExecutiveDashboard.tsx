import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { useLocation } from "wouter";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { useEffect, useMemo } from "react";
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
import { safeChartData } from "@/lib/safeChartData";
import { ChartErrorBoundary } from "@/components/ChartErrorBoundary";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";

const chartData = [
  { day: "Seg", receita: 42, ordens: 18 },
  { day: "Ter", receita: 38, ordens: 16 },
  { day: "Qua", receita: 47, ordens: 21 },
  { day: "Qui", receita: 51, ordens: 24 },
  { day: "Sex", receita: 58, ordens: 27 },
  { day: "Sáb", receita: 36, ordens: 14 },
];

export default function ExecutiveDashboard() {
  return <div style={{ padding: 20 }}>PAGE OK</div>;

  useRenderWatchdog("ExecutiveDashboard");
  const [, navigate] = useLocation();
  const { runAction, isRunning } = useRunAction();
  const safeData = useMemo(
    () => safeChartData<{ day: string; receita: number; ordens: number }>(chartData, ["receita", "ordens"]),
    []
  );
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] executive-dashboard");
    // eslint-disable-next-line no-console
    console.info("[CHART DATA] executive-dashboard.revenue", safeData);
  }, [safeData]);

  return (
    <AppPageShell>
      <AppPageHeader
        title="Centro de decisão operacional"
        description="Visão executiva do fluxo Cliente → Agendamento → O.S. → Cobrança → Pagamento."
        ctaLabel="Executar próxima ação"
        onCta={() => void runAction(async () => navigate("/dashboard/operations"))}
      />

      <KpiErrorBoundary context="executive-dashboard:kpi">
        <AppKpiRow
        items={[
          { label: "Receita", value: "R$ 187,4k", trend: 15.6, context: "+2 hoje · últimos 30 dias", onClick: () => navigate("/finances?view=revenue&period=30d") },
          { label: "Ordens", value: "124", trend: -3.2, context: "-4 hoje · últimos 7 dias", onClick: () => navigate("/service-orders?status=attention&period=7d") },
          { label: "SLA", value: "92,8%", trend: 2.1, context: "estável · últimos 30 dias", onClick: () => navigate("/service-orders?metric=sla&period=30d") },
          { label: "Ticket médio", value: "R$ 1.511", trend: 4.4, context: "+1 hoje · últimos 30 dias", onClick: () => navigate("/finances?metric=average_ticket&period=30d") },
        ]}
      />
      </KpiErrorBoundary>

      <div className="grid gap-3 xl:grid-cols-3">
        <AppChartPanel
          title="Evolução de receita e volume"
          description="Ritmo operacional diário com impacto em faturamento."
          trendValue={12.8}
          trendLabel="↑ +12,8% · últimos 7 dias"
          onCtaClick={() => navigate("/finances?chart=revenue_volume&period=7d")}
        >
          {!safeData.isValid ? (
            <p className="text-sm text-[var(--text-muted)]">Erro ao renderizar gráfico.</p>
          ) : (
            <ChartErrorBoundary context="executive-dashboard:revenue-chart">
              <ChartContainer
                className="h-[260px] w-full"
                config={{ receita: { label: "Receita" }, ordens: { label: "Ordens" } }}
              >
                <AreaChart data={safeData.data}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="receita" stroke="var(--brand-primary)" fill="var(--brand-primary)" fillOpacity={0.25} />
                  <Area type="monotone" dataKey="ordens" stroke="var(--color-info)" fill="var(--color-info)" fillOpacity={0.1} />
                </AreaChart>
              </ChartContainer>
            </ChartErrorBoundary>
          )}
        </AppChartPanel>

        <AppSectionBlock title="Itens que exigem atenção" subtitle="Prioridades do dia" onCtaClick={() => navigate("/dashboard/operations?filter=critical")}>
          <AppAlertList alerts={[{ text: "5 O.S. atrasadas aguardando execução", tone: "danger" }, { text: "12 cobranças vencidas sem negociação", tone: "warning" }, { text: "2 clientes sem retorno há 7 dias", tone: "warning" }]} />
        </AppSectionBlock>

        <AppSectionBlock title="Atividade recente" subtitle="Atualizações em tempo real" onCtaClick={() => navigate("/timeline?scope=recent")}>
          <AppRecentActivity items={["O.S. #1847 concluída há 3 min", "Pagamento recebido há 8 min", "Novo agendamento criado há 14 min", "Mensagem enviada ao cliente há 20 min"]} />
        </AppSectionBlock>
      </div>

      <AppSectionBlock title="Ordens críticas" subtitle="Foco operacional dominante">
        <AppListBlock
          items={[
            { title: "O.S. #1851 · Instalação comercial", subtitle: "Cliente Atlas · Prazo hoje 17:00", right: <AppStatusBadge label="Urgente" />, action: <Button size="sm" onClick={() => void runAction(async () => navigate("/service-orders?os=1851"))} isLoading={isRunning}>Abrir</Button> },
            { title: "O.S. #1849 · Manutenção preventiva", subtitle: "Equipe Norte · 2h de atraso", right: <AppStatusBadge label="Atrasado" />, action: <Button size="sm" onClick={() => void runAction(async () => navigate("/service-orders?os=1849&action=advance-status"))} isLoading={isRunning}>Avançar status</Button> },
            { title: "O.S. #1844 · Retorno técnico", subtitle: "Risco de multa contratual", right: <AppStatusBadge label="Em risco" />, action: <Button size="sm" onClick={() => void runAction(async () => navigate("/whatsapp?customer=atlas&context=charge"))} isLoading={isRunning}>Cobrar</Button> },
          ]}
        />
      </AppSectionBlock>

      <AppSectionBlock title="Próximas ações" subtitle="Execução direta sem sair do fluxo">
        <AppListBlock
          items={[
            {
              title: "Cliente Atlas com pagamento atrasado",
              subtitle: "Cobrança vencida há 2 dias",
              action: <Button size="sm" onClick={() => void runAction(async () => navigate("/finances?status=overdue&customer=atlas"))} isLoading={isRunning}>Resolver agora</Button>,
            },
            {
              title: "O.S. #1849 atrasada",
              subtitle: "Equipe Norte · SLA em risco",
              action: <Button size="sm" onClick={() => void runAction(async () => navigate("/service-orders?os=1849&status=delayed"))} isLoading={isRunning}>Resolver agora</Button>,
            },
          ]}
        />
      </AppSectionBlock>
    </AppPageShell>
  );
}
