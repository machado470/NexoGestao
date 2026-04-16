import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { useEffect } from "react";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppKpiRow,
  AppListBlock,
  AppNextActionCard,
  AppPageShell,
  AppSectionBlock,
} from "@/components/internal-page-system";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";

export default function ExecutiveDashboard() {
  useRenderWatchdog("ExecutiveDashboard");
  const [, navigate] = useLocation();
  const { runAction } = useRunAction();
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
          gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
          items={[
            { label: "Receita", value: "R$ 187,4k", trend: 15.6, context: "+2 hoje · últimos 30 dias", onClick: () => navigate("/finances?view=revenue&period=30d") },
            { label: "Ordens", value: "124", trend: -3.2, context: "-4 hoje · últimos 7 dias", onClick: () => navigate("/service-orders?status=attention&period=7d") },
            { label: "SLA", value: "92,8%", trend: 2.1, context: "estável · últimos 30 dias", onClick: () => navigate("/service-orders?metric=sla&period=30d") },
            { label: "Ticket médio", value: "R$ 1.511", trend: 4.4, context: "+1 hoje · últimos 30 dias", onClick: () => navigate("/finances?metric=average_ticket&period=30d") },
          ]}
        />
      </KpiErrorBoundary>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AppNextActionCard
          title="Próxima ação recomendada"
          description="Atue primeiro nas O.S. atrasadas para proteger SLA e reduzir efeito em cobrança."
          severity="high"
          metadata="centro executivo"
          action={{ label: "Abrir ordens críticas", onClick: () => navigate("/service-orders?status=attention&period=7d") }}
        />
        <AppSectionBlock title="O que está parado agora" subtitle="Bloqueios que pedem reação hoje" compact>
          <AppListBlock
            compact
            maxItems={3}
            minItems={0}
            showPlaceholders={false}
            items={[
              { title: `${clientesSemResposta} clientes sem resposta`, subtitle: "Esfria oportunidade comercial", action: <Button size="sm" variant="outline" onClick={() => navigate("/whatsapp?status=awaiting-reply")}>Contato</Button> },
              { title: `${ordensTravadas} ordens travadas`, subtitle: "Impacto direto no SLA", action: <Button size="sm" variant="outline" onClick={() => navigate("/service-orders?status=attention&period=7d")}>Destravar</Button> },
              { title: `${cobrancasPendentes} cobranças pendentes`, subtitle: "Receita aberta sem follow-up", action: <Button size="sm" variant="outline" onClick={() => navigate("/finances?status=pending&priority=high")}>Cobrar</Button> },
            ]}
          />
          <div className="mt-2">
            <Button size="sm" variant="ghost" className="h-auto p-0 text-xs" onClick={() => navigate("/dashboard/operations?filter=blocked")}>Ver todos os bloqueios</Button>
          </div>
        </AppSectionBlock>

        <AppSectionBlock title="O que pode virar dinheiro hoje" subtitle="Oportunidades para gerar caixa ainda no dia" compact>
          <AppListBlock
            compact
            maxItems={3}
            minItems={0}
            showPlaceholders={false}
            items={[
              { title: `${osSemCobranca} O.S. concluídas sem cobrança`, subtitle: "Serviço entregue sem faturamento", action: <Button size="sm" variant="outline" onClick={() => navigate("/finances?status=pending&source=service-order")}>Faturar</Button> },
              { title: `${clientesSemCobrancaRecente} clientes sem cobrança recente`, subtitle: "Risco de atraso no ciclo de receita", action: <Button size="sm" variant="outline" onClick={() => navigate("/finances?segment=active&status=stale")}>Reativar</Button> },
              { title: `${cobrancasComAltaConversao} cobranças com alta conversão`, subtitle: "Janela comercial favorável agora", action: <Button size="sm" variant="outline" onClick={() => navigate("/finances?status=pending&priority=high")}>Priorizar</Button> },
            ]}
          />
          <div className="mt-2">
            <Button size="sm" variant="ghost" className="h-auto p-0 text-xs" onClick={() => navigate("/finances?view=pipeline")}>Ver pipeline financeiro</Button>
          </div>
        </AppSectionBlock>

        <AppSectionBlock title="Itens que exigem atenção" subtitle="Prioridades do dia" ctaLabel="Ver detalhes" onCtaClick={() => navigate("/dashboard/operations?filter=critical")} compact>
          <AppListBlock
            compact
            maxItems={4}
            minItems={0}
            showPlaceholders={false}
            items={[
              { title: "5 O.S. atrasadas aguardando execução", subtitle: "Risco direto para SLA e remarcações.", action: <Button size="sm" onClick={() => navigate("/service-orders?status=attention")}>Atuar</Button> },
              { title: "12 cobranças vencidas sem negociação", subtitle: "Pressão sobre caixa e previsibilidade de receita.", action: <Button size="sm" onClick={() => navigate("/finances?status=overdue")}>Cobrar</Button> },
              { title: "2 clientes sem retorno há 7 dias", subtitle: "Churn potencial se não houver contato agora.", action: <Button size="sm" onClick={() => navigate("/whatsapp")}>Contato</Button> },
              { title: `${agendaSemConfirmacao} agendas sem confirmação`, subtitle: "Risco de no-show no turno atual.", action: <Button size="sm" onClick={() => navigate("/appointments?status=unconfirmed")}>Confirmar</Button> },
            ]}
          />
        </AppSectionBlock>

        <AppSectionBlock title="Atividade recente" subtitle="Atualizações em tempo real" ctaLabel="Ver tudo" onCtaClick={() => navigate("/timeline?scope=recent")} compact>
          <AppListBlock
            compact
            maxItems={4}
            minItems={0}
            showPlaceholders={false}
            items={[
              { title: "O.S. #1847 concluída há 3 min", subtitle: "Finalize cobrança vinculada para fechar ciclo.", action: <Button size="sm" onClick={() => navigate("/finances?serviceOrderId=1847")}>Cobrar</Button> },
              { title: "Pagamento recebido há 8 min", subtitle: "Sem pendência adicional no momento." },
              { title: "Novo agendamento criado há 14 min", subtitle: "Confirmação ainda pendente.", action: <Button size="sm" onClick={() => navigate("/appointments?status=unconfirmed")}>Confirmar</Button> },
              { title: "Mensagem enviada ao cliente há 20 min", subtitle: "Acompanhe resposta em andamento.", action: <Button size="sm" onClick={() => navigate("/timeline?scope=recent")}>Acompanhar</Button> },
            ]}
          />
        </AppSectionBlock>

        <AppSectionBlock title="Alertas críticos" subtitle="Focos de risco operacional e financeiro" ctaLabel="Ver alertas" onCtaClick={() => navigate("/dashboard/operations?filter=critical")} compact>
          <AppListBlock
            compact
            maxItems={3}
            minItems={0}
            showPlaceholders={false}
            items={[
              { title: "2 cobranças acima de 45 dias", subtitle: "Risco elevado de inadimplência prolongada", action: <Button size="sm" onClick={() => navigate("/finances?status=overdue&aging=45+")}>Negociar</Button> },
              { title: "3 O.S. críticas sem responsável", subtitle: "Execução travada em demandas prioritárias", action: <Button size="sm" onClick={() => navigate("/service-orders?status=attention&owner=unassigned")}>Atribuir</Button> },
              { title: "4 clientes VIP sem retorno em 24h", subtitle: "Alto impacto potencial em retenção", action: <Button size="sm" onClick={() => navigate("/whatsapp?segment=vip&status=awaiting-reply")}>Responder</Button> },
            ]}
          />
        </AppSectionBlock>
      </div>
    </AppPageShell>
  );
}
