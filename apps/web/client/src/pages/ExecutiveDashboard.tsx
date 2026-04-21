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
import { WorkspaceScaffold } from "@/components/operating-system/WorkspaceScaffold";

const clientesSemRetorno = 4;
const agendaSemConfirmacao = 3;
const ordensComBloqueio = 1;
const ordensAbertas = 18;
const ordensConcluidas = 124;
const cobrancasVencidas = 6;

const fluxoOperacional = [
  {
    etapa: "Cliente",
    estado: `${clientesSemRetorno} sem retorno`,
    status: "risco",
    actionLabel: "Ativar follow-up",
    onClickPath: "/customers?segment=inactive",
  },
  {
    etapa: "Agendamento",
    estado: `${agendaSemConfirmacao} sem confirmação`,
    status: "alerta",
    actionLabel: "Confirmar agenda",
    onClickPath: "/appointments?status=pending-confirmation",
  },
  {
    etapa: "O.S.",
    estado: `${ordensComBloqueio} bloqueada`,
    status: "bloqueio",
    actionLabel: "Destravar execução",
    onClickPath: "/service-orders?status=attention",
  },
  {
    etapa: "Cobrança",
    estado: `${cobrancasVencidas} vencidas`,
    status: "alerta",
    actionLabel: "Cobrar carteira",
    onClickPath: "/finances?view=charges&status=overdue",
  },
  {
    etapa: "Pagamento",
    estado: "Fluxo parcial",
    status: "ok",
    actionLabel: "Revisar caixa",
    onClickPath: "/finances?view=cashflow",
  },
] as const;

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <KpiErrorBoundary context="executive-dashboard:kpi">
            <AppKpiRow
              gridClassName="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
              items={[
                {
                  title: "Receita",
                  value: "R$ 187,4k",
                  delta: "+15,6%",
                  trend: "up",
                  hint: "crescimento sustentado · converter em caixa hoje",
                  footer: "Impulso: cobranças vencidas seguram parte da alta.",
                  ctaLabel: "Atuar no financeiro",
                  onClick: () => navigate("/finances?view=revenue&period=30d"),
                },
                {
                  title: "Ordens abertas",
                  value: String(ordensAbertas),
                  delta: "-3,2%",
                  trend: "down",
                  hint: `${ordensComBloqueio} com bloqueio · throughput sensível`,
                  footer: "Risco: atraso em cadeia no turno se não destravar.",
                  ctaLabel: "Destravar O.S.",
                  onClick: () =>
                    navigate("/service-orders?status=attention&period=7d"),
                },
                {
                  title: "SLA",
                  value: "92,8%",
                  delta: "+2,1%",
                  trend: "up",
                  hint: "na meta, com pressão em confirmação de agenda",
                  footer: "Ação: confirmar clientes críticos antes da próxima janela.",
                  ctaLabel: "Proteger SLA",
                  onClick: () =>
                    navigate("/appointments?status=pending-confirmation"),
                },
                {
                  title: "Ticket médio",
                  value: "R$ 1.511",
                  delta: "+4,4%",
                  trend: "up",
                  hint: "mix melhorando · manter conversão pós-serviço",
                  footer: "Foco: recuperar clientes sem retorno para recompra.",
                  ctaLabel: "Ativar carteira",
                  onClick: () =>
                    navigate("/finances?metric=average_ticket&period=30d"),
                },
              ]}
            />
          </KpiErrorBoundary>

          <AppSectionBlock
            title="Fluxo operacional do Nexo"
            subtitle="Cliente → Agendamento → O.S. → Cobrança → Pagamento com ação direta por etapa."
            ctaLabel="Abrir operação crítica"
            onCtaClick={() => navigate("/dashboard/operations?filter=critical")}
          >
            <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-5">
              {fluxoOperacional.map(item => (
                <li
                  key={item.etapa}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      {item.etapa}
                    </p>
                    <AppStatusBadge
                      label={
                        item.status === "bloqueio"
                          ? "BLOQUEIO"
                          : item.status === "risco"
                            ? "RISCO"
                            : item.status === "alerta"
                              ? "ATENÇÃO"
                              : "OK"
                      }
                    />
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">
                    {item.estado}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
                    onClick={() => navigate(item.onClickPath)}
                  >
                    {item.actionLabel}
                  </button>
                </li>
              ))}
            </ul>
          </AppSectionBlock>
        </div>

        <AppSectionBlock
          title="Centro de decisão operacional"
          subtitle="Prioridade do turno com justificativa curta e execução imediata."
          className="xl:col-span-4"
          ctaLabel="Executar prioridade agora"
          onCtaClick={() => navigate("/appointments?status=pending-confirmation")}
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--dashboard-danger)]/35 bg-[var(--surface-subtle)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Faça isso agora
                </p>
                <AppStatusBadge label="CRÍTICO" />
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
                Confirmar {agendaSemConfirmacao} agendamentos antes do próximo lote de saída.
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Sem confirmação, o time entra em rota ociosa e o SLA perde proteção nas próximas 4h.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--dashboard-warning)]/30 bg-[var(--surface-subtle)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Próximo passo
              </p>
              <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">
                1) Confirmar agenda crítica → 2) Destravar {ordensComBloqueio} O.S. → 3) Acionar cobrança vencida.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => navigate("/appointments?status=pending-confirmation")}
              >
                Confirmar agenda
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate("/service-orders?status=attention")}
              >
                Destravar O.S.
              </Button>
            </div>
          </div>
        </AppSectionBlock>

        <AppSectionBlock
          title="Pulso executivo"
          subtitle="Sinais rápidos por tipo de pressão operacional"
          className="xl:col-span-4"
          ctaLabel="Abrir fila priorizada"
          onCtaClick={() => navigate("/dashboard/operations?filter=critical")}
          compact
        >
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <CircleAlert className="mt-0.5 h-4 w-4 text-[var(--dashboard-warning)]" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Pressão de agenda
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {agendaSemConfirmacao} confirmações pendentes para janela crítica da manhã.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--dashboard-danger)]" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Bloqueio de execução
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {ordensComBloqueio} O.S. parada há +2h com risco de atraso em cadeia.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-[var(--dashboard-info)]" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Risco financeiro
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {cobrancasVencidas} cobranças vencidas segurando entrada de caixa.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <ArrowRight className="mt-0.5 h-4 w-4 text-[var(--dashboard-info)]" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Capacidade disponível
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {ordensConcluidas} ordens concluídas de 140 previstas no ciclo.
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
          className="xl:col-span-6"
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
          className="xl:col-span-6"
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

        <div className="xl:col-span-12">
          <WorkspaceScaffold
            title="Preparação para workspace operacional"
            subtitle="Estrutura já alinhada para contexto principal + timeline + comunicação + financeiro sem modal gigante."
            primaryAction={{
              label: "Abrir operação crítica",
              onClick: () => navigate("/dashboard/operations?filter=critical"),
            }}
            context={
              <AppSectionBlock
                title="Contexto principal"
                subtitle="Resumo mínimo para iniciar ação sem trocar de rota."
                compact
              >
                <p className="text-xs text-[var(--text-secondary)]">
                  {agendaSemConfirmacao} agendamentos críticos, {ordensComBloqueio} O.S. bloqueada e{" "}
                  {clientesSemRetorno} clientes sem retorno no ciclo atual.
                </p>
              </AppSectionBlock>
            }
            timeline={
              <AppSectionBlock title="Timeline" subtitle="Evidências recentes da operação." compact>
                <p className="text-xs text-[var(--text-secondary)]">
                  Últimos eventos críticos disponíveis em Timeline e Governança para auditoria.
                </p>
              </AppSectionBlock>
            }
            communication={
              <AppSectionBlock title="Comunicação" subtitle="Ação contextual por WhatsApp." compact>
                <p className="text-xs text-[var(--text-secondary)]">
                  Dispare confirmação, cobrança ou notificação sem perder o vínculo com cliente, agenda e O.S.
                </p>
              </AppSectionBlock>
            }
            finance={
              <AppSectionBlock title="Financeiro" subtitle="Conversão de execução em caixa." compact>
                <p className="text-xs text-[var(--text-secondary)]">
                  Priorizar vencidas e abrir cobrança vinculada ao serviço concluído sem retrabalho.
                </p>
              </AppSectionBlock>
            }
          />
        </div>
      </div>
    </AppPageShell>
  );
}
