import { lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import { useEffect, useState } from "react";
import { OperationalTopCard } from "@/components/operating-system/OperationalTopCard";
import {
  AppKpiRow,
  AppNextActionCard,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { KpiErrorBoundary } from "@/components/KpiErrorBoundary";
import { Progress } from "@/components/ui/progress";

const OperationalFlowChart = lazy(() =>
  import("@/components/dashboard/OperationalFlowChart").then(mod => ({
    default: mod.OperationalFlowChart,
  }))
);

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
  const [flowView, setFlowView] = useState<"orders" | "revenue">("orders");
  const ordensTravadas = 5;
  const clientesSemResposta = 2;
  const agendaSemConfirmacao = 4;

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
        const [entry] = window.performance.getEntriesByName("dashboard:mount->first-frame").slice(-1);
        if (entry) {
          // eslint-disable-next-line no-console
          console.info("[PERF] dashboard_first_frame_ms", Math.round(entry.duration));
        }
      });
    }
  }, []);

  const operationalFlow = [
    { day: "01 Abr", orders: 22, revenue: 11.2 },
    { day: "02 Abr", orders: 26, revenue: 13.8 },
    { day: "03 Abr", orders: 19, revenue: 10.6 },
    { day: "04 Abr", orders: 30, revenue: 16.4 },
    { day: "05 Abr", orders: 24, revenue: 12.9 },
    { day: "06 Abr", orders: 28, revenue: 15.1 },
    { day: "07 Abr", orders: 34, revenue: 17.8 },
    { day: "08 Abr", orders: 31, revenue: 16.9 },
    { day: "09 Abr", orders: 27, revenue: 14.2 },
    { day: "10 Abr", orders: 35, revenue: 19.6 },
    { day: "11 Abr", orders: 29, revenue: 15.4 },
    { day: "12 Abr", orders: 37, revenue: 20.7 },
    { day: "13 Abr", orders: 33, revenue: 18.2 },
    { day: "14 Abr", orders: 39, revenue: 22.4 },
  ];

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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AppSectionBlock
          title="Próxima ação recomendada"
          subtitle="Prioridade operacional para proteger SLA e reduzir impacto financeiro"
          className="flex h-full min-h-[230px] flex-col rounded-xl border-rose-500/35 bg-gradient-to-b from-rose-500/12 to-[var(--surface-elevated)]"
        >
          <div className="mb-3">
            <AppNextActionCard
              title="Destravar O.S. críticas do turno"
              description="Comece pelas ordens com maior risco de SLA para liberar o fluxo de cobrança."
              severity="critical"
              action={{ label: "Abrir ordens críticas", onClick: () => navigate("/service-orders?status=attention&period=7d") }}
            />
          </div>
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
          title="Fluxo Operacional"
          subtitle="Últimos 14 dias"
          className="h-full min-h-[340px] xl:col-span-3"
        >
          <div className="mb-3 flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant={flowView === "orders" ? "default" : "ghost"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setFlowView("orders")}
            >
              Ordens
            </Button>
            <Button
              size="sm"
              variant={flowView === "revenue" ? "default" : "ghost"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setFlowView("revenue")}
            >
              Receita
            </Button>
          </div>

          <div className="h-[250px] w-full">
            <Suspense
              fallback={(
                <div className="h-full w-full animate-pulse rounded-lg border border-[var(--border-subtle)]/60 bg-[var(--surface-base)]/40" />
              )}
            >
              <OperationalFlowChart data={operationalFlow} flowView={flowView} />
            </Suspense>
          </div>
        </AppSectionBlock>

        <AppSectionBlock
          title="Alertas Críticos"
          subtitle="Ver alertas"
          ctaLabel="Ver alertas"
          onCtaClick={() => navigate("/dashboard/operations?filter=critical")}
          compact
          className="flex h-full min-h-[340px] flex-col"
        >
          <CompactOperationalRows
            items={[
              { title: "2 cobranças acima de 45 dias", subtitle: "Financeiro • carteira B", status: "Em risco", actionLabel: "Negociar", onAction: () => navigate("/finances?status=overdue&aging=45+") },
              { title: `${ordensTravadas} O.S. críticas travadas`, subtitle: "Operação de campo • setor norte", status: "Bloqueado", actionLabel: "Atuar", onAction: () => navigate("/service-orders?status=attention&period=7d") },
              { title: `${clientesSemResposta} clientes VIP sem retorno`, subtitle: "Relacionamento • canal WhatsApp", status: "Urgente", actionLabel: "Responder", onAction: () => navigate("/whatsapp?segment=vip&status=awaiting-reply") },
              { title: `${agendaSemConfirmacao} agendas sem confirmação`, subtitle: "Agenda • período da tarde", status: "Pendente", actionLabel: "Confirmar", onAction: () => navigate("/appointments?status=unconfirmed") },
            ]}
          />
        </AppSectionBlock>

        <AppSectionBlock
          title="Performance Equipe"
          subtitle="Execução do turno em andamento"
          className="flex h-full min-h-[220px] flex-col"
        >
          <div className="space-y-4">
            {[{ name: "Equipe Alpha", value: 94 }, { name: "Equipe Beta", value: 87 }, { name: "Equipe Gamma", value: 78 }].map(team => (
              <div key={team.name}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--text-secondary)]">{team.name}</span>
                  <span className="text-[var(--text-muted)]">{team.value}%</span>
                </div>
                <Progress value={team.value} className="h-1.5 rounded-full bg-[var(--surface-base)] [&>div]:bg-gradient-to-r [&>div]:from-cyan-400 [&>div]:to-indigo-500" />
              </div>
            ))}
          </div>
        </AppSectionBlock>

        <AppSectionBlock
          title="Agenda Hoje"
          subtitle="Compromissos operacionais prioritários"
          compact
          className="flex h-full min-h-[220px] flex-col"
        >
          <CompactOperationalRows
            items={[
              { title: "09:00 • Reunião de alinhamento", subtitle: "Sala Estratégia", status: "Confirmado" },
              { title: "11:30 • Revisão de SLA", subtitle: "Operações", status: "Atenção" },
              { title: "14:00 • Follow-up financeiro", subtitle: "Contas em atraso", status: "Crítico" },
              { title: "17:00 • Fechamento do turno", subtitle: "Diretoria", status: "Pendente" },
            ]}
          />
        </AppSectionBlock>

        <AppSectionBlock
          title="Alertas do Sistema"
          subtitle="Monitoramento técnico e estabilidade"
          compact
          className="flex h-full min-h-[220px] flex-col"
        >
          <CompactOperationalRows
            items={[
              { title: "Latência acima do esperado", subtitle: "API de cobrança • 312ms", status: "Médio" },
              { title: "2 integrações aguardando sync", subtitle: "ERP e WhatsApp", status: "Atenção" },
              { title: "Fila de notificações em alta", subtitle: "Pico nas últimas 2h", status: "Alto" },
              { title: "Backup diário concluído", subtitle: "Datacenter primário", status: "OK" },
            ]}
          />
        </AppSectionBlock>
      </div>
    </AppPageShell>
  );
}
