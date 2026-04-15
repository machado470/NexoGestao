import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { useEffect } from "react";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppAlertList,
  AppKpiRow,
  AppListBlock,
  AppNextActionCard,
  AppPageShell,
  AppRecentActivity,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";

export default function ExecutiveDashboard() {
  useRenderWatchdog("ExecutiveDashboard");
  const [, navigate] = useLocation();
  const { runAction, isRunning } = useRunAction();
  const ordensTravadas = 5;
  const clientesSemResposta = 2;
  const cobrancasPendentes = 12;
  const agendaSemConfirmacao = 4;
  const osSemCobranca = 8;
  const clientesSemCobrancaRecente = 6;
  const cobrancasComAltaConversao = 9;

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] executive-dashboard");
  }, []);

  return (
    <AppPageShell>
      <OperationalTopCard
        contextLabel="Direção executiva"
        title="Centro de decisão operacional"
        description="Visão executiva do fluxo Cliente → Agendamento → O.S. → Cobrança → Pagamento."
        primaryAction={(
          <Button onClick={() => void runAction(async () => navigate("/dashboard/operations"))}>
            Executar próxima ação
          </Button>
        )}
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
        <AppNextActionCard
          title="Próxima ação recomendada"
          description="Atue primeiro nas O.S. atrasadas para proteger SLA e reduzir efeito em cobrança."
          severity="high"
          metadata="centro executivo"
          action={{ label: "Abrir ordens críticas", onClick: () => navigate("/service-orders?status=attention&period=7d") }}
        />
        <AppSectionBlock title="O que está parado agora" subtitle="Bloqueios que pedem reação hoje">
          <AppListBlock
            items={[
              { title: `${clientesSemResposta} clientes sem resposta`, subtitle: "Risco de esfriar oportunidade comercial" },
              { title: `${ordensTravadas} ordens travadas`, subtitle: "Impacto direto no SLA e na agenda" },
              { title: `${cobrancasPendentes} cobranças pendentes`, subtitle: "Valor em aberto sem follow-up ativo" },
              { title: `${agendaSemConfirmacao} agendamentos sem confirmação`, subtitle: "Pode virar no-show ainda hoje" },
            ]}
          />
          <div className="mt-3">
            <Button onClick={() => navigate("/dashboard/operations?filter=critical")}>Resolver agora</Button>
          </div>
        </AppSectionBlock>

        <AppSectionBlock title="O que pode virar dinheiro hoje" subtitle="Oportunidades para gerar caixa ainda no dia">
          <AppListBlock
            items={[
              { title: `${osSemCobranca} O.S. concluídas sem cobrança`, subtitle: "Serviço finalizado sem passo financeiro" },
              { title: `${clientesSemCobrancaRecente} clientes ativos sem cobrança recente`, subtitle: "Risco de atraso no ciclo de receita" },
              { title: `${cobrancasComAltaConversao} cobranças com alta chance de conversão`, subtitle: "Janela boa para contato imediato" },
            ]}
          />
          <div className="mt-3">
            <Button onClick={() => navigate("/finances?status=pending&priority=high")}>Cobrar agora</Button>
          </div>
        </AppSectionBlock>

        <AppSectionBlock title="Itens que exigem atenção" subtitle="Prioridades do dia" onCtaClick={() => navigate("/dashboard/operations?filter=critical")}>
          <AppAlertList alerts={[{ text: "5 O.S. atrasadas aguardando execução", tone: "danger" }, { text: "12 cobranças vencidas sem negociação", tone: "warning" }, { text: "2 clientes sem retorno há 7 dias", tone: "warning" }]} />
        </AppSectionBlock>

        <AppSectionBlock title="Atividade recente" subtitle="Atualizações em tempo real" onCtaClick={() => navigate("/timeline?scope=recent")}>
          <AppRecentActivity items={["O.S. #1847 concluída há 3 min", "Pagamento recebido há 8 min", "Novo agendamento criado há 14 min", "Mensagem enviada ao cliente há 20 min"]} />
        </AppSectionBlock>
      </div>

      <AppSectionBlock title="Saúde operacional" subtitle="Foco operacional dominante">
        <AppListBlock
          items={[
            { title: "O.S. #1851 · Instalação comercial", subtitle: "Cliente Atlas · Prazo hoje 17:00", right: <AppStatusBadge label="Urgente" />, action: <Button size="sm" onClick={() => void runAction(async () => navigate("/service-orders?os=1851"))} isLoading={isRunning}>Abrir</Button> },
            { title: "O.S. #1849 · Manutenção preventiva", subtitle: "Equipe Norte · 2h de atraso", right: <AppStatusBadge label="Atrasado" />, action: <Button size="sm" onClick={() => void runAction(async () => navigate("/service-orders?os=1849&action=advance-status"))} isLoading={isRunning}>Avançar status</Button> },
            { title: "O.S. #1844 · Retorno técnico", subtitle: "Risco de multa contratual", right: <AppStatusBadge label="Em risco" />, action: <Button size="sm" onClick={() => void runAction(async () => navigate("/whatsapp?customer=atlas&context=charge"))} isLoading={isRunning}>Cobrar</Button> },
          ]}
        />
      </AppSectionBlock>

      <AppSectionBlock title="Falhas / bloqueios" subtitle="Execução direta sem sair do fluxo">
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

      <AppSectionBlock title="Próximas decisões das 2 horas" subtitle="Fechamento objetivo para não deixar a operação parar">
        <AppListBlock
          items={[
            { title: "Cobrar clientes com vencimento de hoje", subtitle: "Protege o caixa do fim do dia", action: <Button size="sm" onClick={() => navigate("/finances?window=today")}>Cobrar agora</Button> },
            { title: "Reatribuir O.S. sem responsável", subtitle: "Evita acúmulo no turno seguinte", action: <Button size="sm" onClick={() => navigate("/service-orders?status=unassigned")}>Resolver agora</Button> },
            { title: "Confirmar agenda do próximo período", subtitle: "Reduz faltas e remarcações", action: <Button size="sm" onClick={() => navigate("/appointments?status=unconfirmed")}>Confirmar</Button> },
          ]}
        />
      </AppSectionBlock>
    </AppPageShell>
  );
}
