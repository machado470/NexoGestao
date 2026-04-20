import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowRight,
  CircleAlert,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import {
  AppKpiRow,
  AppPageHeader,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";
import { ExecutiveTrendChart } from "@/components/dashboard/ExecutiveTrendChart";
import { WhatsAppOverviewCard } from "@/components/dashboard/WhatsAppOverviewCard";

const clientesSemRetorno = 4;
const agendaSemConfirmacao = 3;
const ordensComBloqueio = 1;
const ordensAbertas = 18;
const ordensConcluidas = 124;

export default function ExecutiveDashboard() {
  useRenderWatchdog("ExecutiveDashboard");
  const [, navigate] = useLocation();
  const { runAction } = useRunAction();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] executive-dashboard");
    if (typeof window !== "undefined") {
      window.performance.mark("dashboard:mount");
      window.requestAnimationFrame(() => {
        window.performance.mark("dashboard:first-frame");
        window.performance.measure(
          "dashboard:mount->first-frame",
          "dashboard:mount",
          "dashboard:first-frame"
        );
        const [entry] = window.performance
          .getEntriesByName("dashboard:mount->first-frame")
          .slice(-1);
        if (entry) {
          // eslint-disable-next-line no-console
          console.info(
            "[PERF] dashboard_first_frame_ms",
            Math.round(entry.duration)
          );
        }
      });
    }
  }, []);

  return (
    <AppPageShell>
      <AppPageHeader
        title="Executive Dashboard"
        description="Centro de decisão do fluxo Cliente → Agendamento → O.S. → Cobrança → Pagamento, com foco em risco, gargalo e próxima ação."
        secondaryActions={
          <Button
            variant="outline"
            onClick={() => navigate("/dashboard/operations")}
          >
            Abrir fila operacional
          </Button>
        }
        cta={
          <Button
            onClick={() =>
              void runAction(async () =>
                navigate("/dashboard/operations?filter=critical")
              )
            }
          >
            Executar próxima ação
          </Button>
        }
      />

      <KpiErrorBoundary context="executive-dashboard:kpi">
        <AppKpiRow
          gridClassName="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
          items={[
            {
              label: "Receita",
              value: "R$ 187,4k",
              trend: 15.6,
              context: "+2 hoje · últimos 30 dias",
              onClick: () => navigate("/finances?view=revenue&period=30d"),
            },
            {
              label: "Ordens abertas",
              value: String(ordensAbertas),
              trend: -3.2,
              context: `${ordensComBloqueio} com bloqueio · últimos 7 dias`,
              onClick: () =>
                navigate("/service-orders?status=attention&period=7d"),
            },
            {
              label: "SLA",
              value: "92,8%",
              trend: 2.1,
              context: "estável · últimos 30 dias",
              onClick: () => navigate("/service-orders?metric=sla&period=30d"),
            },
            {
              label: "Ticket médio",
              value: "R$ 1.511",
              trend: 4.4,
              context: "+1 hoje · últimos 30 dias",
              onClick: () =>
                navigate("/finances?metric=average_ticket&period=30d"),
            },
          ]}
        />
      </KpiErrorBoundary>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <AppSectionBlock
          title="Centro de decisão operacional"
          subtitle="Prioridade imediata, gargalo principal, próximo passo e risco do turno atual."
          className="xl:col-span-8"
          ctaLabel="Abrir execução"
          onCtaClick={() => navigate("/dashboard/operations?filter=critical")}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--dashboard-danger)]/35 bg-[var(--surface-subtle)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Prioridade agora
                </p>
                <AppStatusBadge label="URGENTE" />
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                Confirmar {agendaSemConfirmacao} agendamentos antes do próximo
                turno.
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Sem confirmação, a janela de execução perde previsibilidade e
                pressiona SLA.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--dashboard-warning)]/35 bg-[var(--surface-subtle)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Gargalo atual
                </p>
                <AppStatusBadge label="ATENÇÃO" />
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                {ordensComBloqueio} O.S. bloqueada em rota há mais de 2h.
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Bloqueio impede fechamento de ordem e pode gerar atraso em
                cadeia.
              </p>
            </div>

            <div className="rounded-lg border border-[var(--dashboard-info)]/35 bg-[var(--surface-subtle)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Próxima melhor ação
                </p>
                <AppStatusBadge label="EXECUTAR" />
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                Rebalancear equipe e disparar confirmação automática por
                WhatsApp.
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <ArrowRight className="h-3.5 w-3.5" />
                <span>
                  Impacto esperado: recuperar janela de atendimento da manhã.
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--dashboard-danger)]/25 bg-[var(--surface-subtle)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Risco crítico
                </p>
                <AppStatusBadge label="EM RISCO" />
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                {clientesSemRetorno} clientes sem retorno pós-serviço em
                carteira ativa.
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Risco direto de churn e queda de recompra no ciclo atual.
              </p>
            </div>
          </div>
        </AppSectionBlock>

        <AppSectionBlock
          title="Pulso executivo"
          subtitle="Estado geral de execução no turno"
          className="xl:col-span-4"
          ctaLabel="Abrir ordens"
          onCtaClick={() => navigate("/service-orders?status=attention")}
          compact
        >
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <CircleAlert className="mt-0.5 h-4 w-4 text-[var(--dashboard-warning)]" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Execução pressionada por confirmação
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {agendaSemConfirmacao} clientes aguardando contato no horário
                  crítico.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--dashboard-danger)]" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Bloqueio impactando throughput
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {ordensComBloqueio} ordem aguardando destrava operacional.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-[var(--dashboard-info)]" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Capacidade do time
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {ordensConcluidas} ordens concluídas de 140 previstas no
                  ciclo.
                </p>
              </div>
            </div>
          </div>
        </AppSectionBlock>

        <ExecutiveTrendChart className="xl:col-span-8" />

        <AppSectionBlock
          title="Leitura da tendência"
          subtitle="Como traduzir a visão do gráfico em decisão operacional"
          className="xl:col-span-4"
          ctaLabel="Abrir financeiro"
          onCtaClick={() => navigate("/finances?view=revenue")}
          compact
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Tendência dominante
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                Receita cresce, mas ordens em atenção reduzem previsibilidade.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Janela de intervenção
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Atuar em confirmação de agenda agora evita efeito cascata nas
                próximas 4h.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Próximo checkpoint
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Revisar SLA e bloqueios no fechamento das 17:00 com status por
                equipe.
              </p>
            </div>
          </div>
        </AppSectionBlock>

        <AppSectionBlock
          title="Central de alertas"
          subtitle="Filas que exigem ação no turno atual"
          className="xl:col-span-5"
          ctaLabel="Abrir operação"
          onCtaClick={() => navigate("/dashboard/operations?filter=critical")}
        >
          <ul className="space-y-3">
            <li className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {agendaSemConfirmacao} agendamentos sem confirmação
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Necessário contato até o meio do turno para evitar remarcação.
                </p>
              </div>
              <AppStatusBadge label="URGENTE" />
            </li>
            <li className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {ordensComBloqueio} O.S. atrasada há mais de 2h
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Necessária tratativa para liberar rota e normalizar execução.
                </p>
              </div>
              <AppStatusBadge label="ATENÇÃO" />
            </li>
            <li className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {clientesSemRetorno} clientes sem retorno pós-serviço
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Priorizar fechamento de ciclo com confirmação de satisfação.
                </p>
              </div>
              <AppStatusBadge label="MONITORAR" />
            </li>
          </ul>
        </AppSectionBlock>

        <AppSectionBlock
          title="Agenda operacional"
          subtitle="Compromissos e checkpoints do dia"
          className="xl:col-span-4"
          ctaLabel="Abrir agenda"
          onCtaClick={() => navigate("/appointments")}
        >
          <ul className="space-y-3">
            {[
              {
                time: "09:00",
                title: "Reunião de alinhamento do turno",
                status: "Confirmado",
              },
              {
                time: "11:30",
                title: "Revisão de SLA e bloqueios",
                status: "Atenção",
              },
              {
                time: "14:00",
                title: "Follow-up financeiro da carteira",
                status: "Em risco",
              },
              {
                time: "17:00",
                title: "Fechamento executivo do dia",
                status: "Pendente",
              },
            ].map(item => (
              <li
                key={item.time}
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                    {item.time}
                  </span>
                  <p className="truncate text-sm text-[var(--text-secondary)]">
                    {item.title}
                  </p>
                </div>
                <AppStatusBadge label={item.status} />
              </li>
            ))}
          </ul>
        </AppSectionBlock>

        <WhatsAppOverviewCard
          className="xl:col-span-3"
          onOpenWhatsApp={() => navigate("/whatsapp")}
        />
      </div>
    </AppPageShell>
  );
}
