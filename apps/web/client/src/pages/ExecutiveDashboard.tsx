import { useLocation } from "wouter";
import { AlertTriangle, ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { useEffect } from "react";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppKpiRow,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";

type DashboardRow = {
  title: string;
  subtitle: string;
  status?: string;
  actionLabel?: string;
  onAction?: () => void;
};

function CompactOperationalRows({ items }: { items: DashboardRow[] }) {
  return (
    <div className="space-y-1.5">
      {items.map(item => (
        <div
          key={item.title}
          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)]/60 bg-[var(--surface-base)]/35 px-2.5 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{item.subtitle}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {item.status ? <AppStatusBadge label={item.status} /> : null}
            {item.onAction ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 rounded-full border-[var(--border-subtle)] px-2.5 text-[11px]"
                onClick={item.onAction}
              >
                {item.actionLabel}
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

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
        <AppSectionBlock
          title="Próxima ação recomendada"
          subtitle="Prioridade operacional para proteger SLA e reduzir impacto financeiro"
          className="flex h-full min-h-[230px] flex-col rounded-xl border-rose-500/35 bg-gradient-to-b from-rose-500/12 to-[var(--surface-elevated)]"
        >
          <div className="mb-2 inline-flex w-fit items-center gap-1 rounded-full border border-rose-500/35 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Prioridade alta
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Atue primeiro nas O.S. atrasadas para destravar execução crítica e preservar previsibilidade de cobrança.
          </p>
          <div className="mt-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Origem: centro executivo</span>
            <span>janela: hoje</span>
          </div>
          <Button
            className="mt-4 h-8 self-start rounded-full px-3 text-xs"
            size="sm"
            onClick={() => navigate("/service-orders?status=attention&period=7d")}
          >
            Abrir ordens críticas
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </AppSectionBlock>

        <AppSectionBlock
          title="O que está parado agora"
          subtitle="Bloqueios que pedem reação no turno atual"
          ctaLabel="Ver tudo"
          onCtaClick={() => navigate("/dashboard/operations?filter=blocked")}
          compact
          className="flex h-full min-h-[230px] flex-col"
        >
          <CompactOperationalRows
            items={[
              { title: `${clientesSemResposta} clientes sem resposta`, subtitle: "Esfria oportunidade comercial", status: "Atenção", actionLabel: "Contato", onAction: () => navigate("/whatsapp?status=awaiting-reply") },
              { title: `${ordensTravadas} ordens travadas`, subtitle: "Impacto direto no SLA", status: "Bloqueado", actionLabel: "Destravar", onAction: () => navigate("/service-orders?status=attention&period=7d") },
              { title: `${cobrancasPendentes} cobranças pendentes`, subtitle: "Receita aberta sem follow-up", status: "Pendente", actionLabel: "Cobrar", onAction: () => navigate("/finances?status=pending&priority=high") },
            ]}
          />
        </AppSectionBlock>

        <AppSectionBlock
          title="O que pode virar dinheiro hoje"
          subtitle="Oportunidades com retorno financeiro imediato"
          ctaLabel="Ver pipeline"
          onCtaClick={() => navigate("/finances?view=pipeline")}
          compact
          className="flex h-full min-h-[230px] flex-col"
        >
          <CompactOperationalRows
            items={[
              { title: `${osSemCobranca} O.S. concluídas sem cobrança`, subtitle: "Serviço entregue sem faturamento", status: "Atrasado", actionLabel: "Faturar", onAction: () => navigate("/finances?status=pending&source=service-order") },
              { title: `${clientesSemCobrancaRecente} clientes sem cobrança recente`, subtitle: "Risco de atraso no ciclo de receita", status: "Atenção", actionLabel: "Reativar", onAction: () => navigate("/finances?segment=active&status=stale") },
              { title: `${cobrancasComAltaConversao} cobranças com alta conversão`, subtitle: "Janela comercial favorável agora", status: "Alta", actionLabel: "Priorizar", onAction: () => navigate("/finances?status=pending&priority=high") },
            ]}
          />
        </AppSectionBlock>

        <AppSectionBlock
          title="Itens que exigem atenção"
          subtitle="Prioridades com impacto direto no dia"
          ctaLabel="Ver detalhes"
          onCtaClick={() => navigate("/dashboard/operations?filter=critical")}
          compact
          className="flex h-full min-h-[230px] flex-col"
        >
          <CompactOperationalRows
            items={[
              { title: "5 O.S. atrasadas aguardando execução", subtitle: "Risco direto para SLA e remarcações", status: "Urgente", actionLabel: "Atuar", onAction: () => navigate("/service-orders?status=attention") },
              { title: "12 cobranças vencidas sem negociação", subtitle: "Pressão sobre caixa e previsibilidade", status: "Em risco", actionLabel: "Cobrar", onAction: () => navigate("/finances?status=overdue") },
              { title: "2 clientes sem retorno há 7 dias", subtitle: "Churn potencial se não houver contato", status: "Atenção", actionLabel: "Contato", onAction: () => navigate("/whatsapp") },
              { title: `${agendaSemConfirmacao} agendas sem confirmação`, subtitle: "Risco de no-show no turno atual", status: "Pendente", actionLabel: "Confirmar", onAction: () => navigate("/appointments?status=unconfirmed") },
            ]}
          />
        </AppSectionBlock>

        <AppSectionBlock
          title="Atividade recente"
          subtitle="Atualizações operacionais em tempo real"
          ctaLabel="Ver tudo"
          onCtaClick={() => navigate("/timeline?scope=recent")}
          compact
          className="flex h-full min-h-[230px] flex-col"
        >
          <CompactOperationalRows
            items={[
              { title: "O.S. #1847 concluída há 3 min", subtitle: "Finalize cobrança vinculada para fechar ciclo", status: "Concluído", actionLabel: "Cobrar", onAction: () => navigate("/finances?serviceOrderId=1847") },
              { title: "Pagamento recebido há 8 min", subtitle: "Sem pendência adicional no momento", status: "Pago" },
              { title: "Novo agendamento criado há 14 min", subtitle: "Confirmação ainda pendente", status: "Pendente", actionLabel: "Confirmar", onAction: () => navigate("/appointments?status=unconfirmed") },
              { title: "Mensagem enviada ao cliente há 20 min", subtitle: "Acompanhe resposta em andamento", status: "Atenção", actionLabel: "Acompanhar", onAction: () => navigate("/timeline?scope=recent") },
            ]}
          />
        </AppSectionBlock>

        <AppSectionBlock
          title="Alertas críticos"
          subtitle="Focos de risco operacional e financeiro"
          ctaLabel="Ver alertas"
          onCtaClick={() => navigate("/dashboard/operations?filter=critical")}
          compact
          className="flex h-full min-h-[230px] flex-col"
        >
          <CompactOperationalRows
            items={[
              { title: "2 cobranças acima de 45 dias", subtitle: "Risco elevado de inadimplência prolongada", status: "Em risco", actionLabel: "Negociar", onAction: () => navigate("/finances?status=overdue&aging=45+") },
              { title: "3 O.S. críticas sem responsável", subtitle: "Execução travada em demandas prioritárias", status: "Bloqueado", actionLabel: "Atribuir", onAction: () => navigate("/service-orders?status=attention&owner=unassigned") },
              { title: "4 clientes VIP sem retorno em 24h", subtitle: "Alto impacto potencial em retenção", status: "Urgente", actionLabel: "Responder", onAction: () => navigate("/whatsapp?segment=vip&status=awaiting-reply") },
            ]}
          />
        </AppSectionBlock>
      </div>
    </AppPageShell>
  );
}
