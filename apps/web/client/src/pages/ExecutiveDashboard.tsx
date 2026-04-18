import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppKpiRow,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";
import { OperationalRadialMetric } from "@/components/dashboard/OperationalRadialMetric";
import { ExecutiveTrendChart } from "@/components/dashboard/ExecutiveTrendChart";

export default function ExecutiveDashboard() {
  useRenderWatchdog("ExecutiveDashboard");
  const [, navigate] = useLocation();
  const { runAction } = useRunAction();
  const ordensTravadas = 5;
  const clientesSemResposta = 2;
  const agendaSemConfirmacao = 4;
  const teamPerformance = [
    { name: "Equipe Alpha", value: 94 },
    { name: "Equipe Beta", value: 87 },
    { name: "Equipe Gamma", value: 78 },
  ];

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
      <OperationalTopCard
        contextLabel="Direção executiva"
        title="Centro de decisão operacional"
        description="Visão executiva do fluxo Cliente → Agendamento → O.S. → Cobrança → Pagamento."
        primaryAction={
          <Button
            onClick={() =>
              void runAction(async () => navigate("/dashboard/operations"))
            }
          >
            Executar próxima ação
          </Button>
        }
      />

      <KpiErrorBoundary context="executive-dashboard:kpi">
        <AppKpiRow
          gridClassName="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
          items={[
            {
              label: "Receita",
              value: "R$ 187,4k",
              trend: 15.6,
              context: "+2 hoje · últimos 30 dias",
              onClick: () => navigate("/finances?view=revenue&period=30d"),
            },
            {
              label: "Ordens",
              value: "124",
              trend: -3.2,
              context: "-4 hoje · últimos 7 dias",
              onClick: () =>
                navigate("/service-orders?status=attention&period=7d"),
            },
            {
              title: "SLA",
              value: (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                    92,8%
                  </span>
                  <OperationalRadialMetric
                    value={93}
                    label="SLA"
                    size={70}
                    thickness={8}
                    color="var(--dashboard-success)"
                    className="gap-0"
                    labelClassName="sr-only"
                    valueClassName="text-xs"
                  />
                </div>
              ),
              delta: "+2,1%",
              trend: "up",
              hint: "estável · últimos 30 dias",
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

      <ExecutiveTrendChart />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <AppSectionBlock
          title="Central de Alertas"
          subtitle="Prioridades críticas para execução imediata"
          className="flex h-full min-h-[280px] flex-col p-6 md:p-8"
          ctaLabel="Abrir operação"
          onCtaClick={() => navigate("/dashboard/operations?filter=critical")}
        >
          <ul className="space-y-4">
            <li className="border-l-2 border-[var(--dashboard-danger)] pl-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {ordensTravadas} O.S. críticas travadas
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Setor norte • impacto direto no SLA do turno.
                  </p>
                </div>
                <AppStatusBadge label="Urgente" />
              </div>
            </li>
            <li className="border-l-2 border-[var(--dashboard-warning)] pl-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    2 cobranças acima de 45 dias
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Carteira B • risco de caixa acumulado.
                  </p>
                </div>
                <AppStatusBadge label="Atenção" />
              </div>
            </li>
            <li className="border-l-2 border-[var(--dashboard-info)] pl-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {clientesSemResposta} clientes VIP sem retorno
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Relacionamento • janela de contato próxima.
                  </p>
                </div>
                <AppStatusBadge label="Monitorar" />
              </div>
            </li>
          </ul>
        </AppSectionBlock>

        <AppSectionBlock
          title="Performance Operacional"
          subtitle="Execução consolidada das equipes do turno"
          className="flex h-full min-h-[280px] flex-col p-6 md:p-8"
        >
          <div className="flex h-full flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-6">
              {teamPerformance.map(team => (
                <div
                  key={team.name}
                  className="flex flex-col items-center gap-2"
                >
                  <OperationalRadialMetric
                    value={team.value}
                    label={team.name}
                    size={112}
                    thickness={10}
                    color={
                      team.value >= 90
                        ? "var(--dashboard-success)"
                        : team.value >= 84
                          ? "var(--dashboard-info)"
                          : "var(--dashboard-warning)"
                    }
                    className="gap-1"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Meta operacional: manter todas as equipes acima de 85% no turno.
            </p>
          </div>
        </AppSectionBlock>

        <AppSectionBlock
          title="Agenda Operacional"
          subtitle="Compromissos com horário e status de execução"
          className="flex h-full min-h-[280px] flex-col p-6 md:p-8"
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

        <AppSectionBlock
          title="Resumo Operacional"
          subtitle="Indicadores centrais com leitura financeira do ciclo"
          className="flex h-full min-h-[280px] flex-col p-6 md:p-8"
        >
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Receita operacional do período
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
                R$ 187,4k
              </p>
              <p className="text-xs text-[var(--dashboard-success)]">
                +15,6% vs. período anterior
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>Ordens concluídas</span>
                  <span>124 / 140</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--dashboard-row-bg)]">
                  <div className="h-full w-[88%] rounded-full bg-[var(--dashboard-info)]" />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>Agenda confirmada</span>
                  <span>{`${100 - agendaSemConfirmacao * 4}%`}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--dashboard-row-bg)]">
                  <div className="h-full w-[84%] rounded-full bg-[var(--dashboard-success)]" />
                </div>
              </div>
            </div>
          </div>
        </AppSectionBlock>
      </div>
    </AppPageShell>
  );
}
