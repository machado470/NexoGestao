import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Clock3, MessageSquareWarning, MoreHorizontal, ShieldAlert, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppStatCard } from "@/components/app-system";
import { useRunAction } from "@/hooks/useRunAction";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import {
  AppPageEmptyState,
  AppPageErrorState,
  AppOperationalHeader,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import { normalizeOperationalState } from "@/lib/operations";

type DashboardState = "healthy" | "alert" | "critical" | "empty" | "error" | "loading";
type Severity = "critical" | "high" | "medium";

const severityWeight: Record<Severity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

const immediateAttentionItems = [
  {
    severity: "critical" as const,
    title: "Cobranças vencidas em lote crítico",
    context: "6 cobranças vencidas há +48h no fechamento do caixa.",
    impact: "Risco de estrangulamento de caixa e atraso de repasses.",
    primaryCtaLabel: "Cobrar agora",
    primaryPath: "/finances?view=charges&status=overdue",
  },
  {
    severity: "critical" as const,
    title: "O.S. atrasadas em rota ativa",
    context: "2 O.S. paradas há mais de 2h após início previsto.",
    impact: "Degrada SLA e empurra atraso para os próximos slots.",
    primaryCtaLabel: "Destravar O.S.",
    primaryPath: "/service-orders?status=attention",
  },
  {
    severity: "high" as const,
    title: "Agendamentos sem confirmação",
    context: "4 clientes sem confirmação para a janela 10:00–12:00.",
    impact: "Risco de ociosidade operacional e quebra de previsibilidade.",
    primaryCtaLabel: "Confirmar agenda",
    primaryPath: "/appointments?status=pending-confirmation",
  },
  {
    severity: "high" as const,
    title: "Falhas em mensagens de confirmação",
    context: "5 mensagens de WhatsApp falharam na última hora.",
    impact: "Aumenta ausência em agendamento e retrabalho.",
    primaryCtaLabel: "Resolver falhas",
    primaryPath: "/timeline?type=whatsapp-failure",
  },
] as const;

const operationalPipeline = [
  {
    stage: "Cliente",
    volume: 138,
    microcontext: "30,4% avançam para agendamento · 3 sem retorno",
    action: "Ativar follow-up",
    path: "/customers?segment=inactive",
  },
  {
    stage: "Agendamento",
    volume: 42,
    microcontext: "66,7% avançam para O.S. · 4 sem confirmação",
    action: "Confirmar agenda",
    path: "/appointments?status=pending-confirmation",
  },
  {
    stage: "O.S.",
    volume: 28,
    microcontext: "75% avançam para cobrança · 2 atrasadas",
    action: "Destravar execução",
    path: "/service-orders?status=attention",
  },
  {
    stage: "Cobrança",
    volume: 21,
    microcontext: "71,4% avançam para pagamento · 6 vencidas",
    action: "Cobrar carteira",
    path: "/finances?view=charges&status=overdue",
  },
  {
    stage: "Pagamento",
    volume: 15,
    microcontext: "Conversão abaixo da meta de 80%",
    action: "Ver recebimentos",
    path: "/finances?view=paid",
  },
] as const;

const operationalQueue = [
  {
    type: "Cobrança vencida",
    entity: "COB-9021 · R$ 4.280 · João Silva",
    status: "Urgente",
    deadline: "Hoje, 11:00",
    actionLabel: "Enviar cobrança",
    path: "/finances?view=charges&status=overdue",
  },
  {
    type: "O.S. atrasada",
    entity: "OS-7841 · Clínica Acácia",
    status: "Atenção",
    deadline: "Hoje, 09:30",
    actionLabel: "Iniciar O.S.",
    path: "/service-orders?status=pending",
  },
  {
    type: "Agendamento",
    entity: "AG-1992 · Clínica Viva",
    status: "Pendente",
    deadline: "Hoje, 10:00",
    actionLabel: "Confirmar",
    path: "/appointments?status=pending-confirmation",
  },
  {
    type: "Cliente sem resposta",
    entity: "Marina Costa · pós-serviço",
    status: "Em risco",
    deadline: "Hoje, 10:15",
    actionLabel: "Responder",
    path: "/customers?segment=needs-contact",
  },
] as const;

function resolveOperationalState(alertCount: number, criticalCount: number): DashboardState {
  if (criticalCount > 1) return "critical";
  if (alertCount > 0) return "alert";
  return "healthy";
}

export default function ExecutiveDashboard() {
  useRenderWatchdog("ExecutiveDashboard");
  const [location, navigate] = useLocation();
  const { runAction } = useRunAction();

  const forcedState = useMemo(() => {
    if (typeof window === "undefined") return null;
    const stateParam = new URLSearchParams(window.location.search).get("state");
    if (
      stateParam === "healthy" ||
      stateParam === "alert" ||
      stateParam === "critical" ||
      stateParam === "empty" ||
      stateParam === "error" ||
      stateParam === "loading"
    ) {
      return stateParam;
    }
    return null;
  }, [location]);

  const immediateAttention = useMemo(
    () => [...immediateAttentionItems].sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]).slice(0, 3),
    []
  );

  const criticalCount = immediateAttention.filter(item => item.severity === "critical").length;
  const computedState = resolveOperationalState(immediateAttention.length, criticalCount);
  const dashboardState: DashboardState = forcedState ?? computedState;

  const operationStateLabel =
    dashboardState === "empty"
      ? "Operação sem dados"
      : dashboardState === "error"
        ? "Falha de leitura operacional"
        : dashboardState === "loading"
          ? "Carregando operação"
          : normalizeOperationalState(dashboardState);

  const operationalPeriodLabel = "Hoje · 22 de abril de 2026 · Turno 08:00–18:00";

  const nextBestAction = {
    action: "Cobrar João Silva — R$ 4.280 vencido há 5 dias",
    reason: "Maior valor em atraso e sem contato recente, com risco de contaminar o fechamento do dia.",
    impact: "Libera caixa imediato, reduz risco operacional financeiro e destrava repasses do turno.",
    ctaLabel: "Enviar cobrança",
    ctaPath: "/finances?view=charges&status=overdue",
  };

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] executive-dashboard-v3-operational-center");
  }, []);

  return (
    <AppPageShell>
      <AppOperationalHeader
        title="Operação hoje"
        description="Acompanhe prioridades, gargalos e execução do dia."
        secondaryActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Ações secundárias do dashboard">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => navigate("/governance")}>Ver governança</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/timeline")}>Abrir timeline</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        primaryAction={
          <Button onClick={() => void runAction(async () => navigate("/dashboard/operations?filter=critical"))}>
            Abrir fila prioritária
          </Button>
        }
        contextChips={
          <>
            <span className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
              {operationalPeriodLabel}
            </span>
            <span className="rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-muted)]">
              Estado geral: {operationStateLabel}
            </span>
          </>
        }
      />

      {dashboardState === "loading" ? <AppPageLoadingState /> : null}
      {dashboardState === "error" ? (
        <AppPageErrorState
          description="Não foi possível carregar os sinais operacionais do Dashboard."
          actionLabel="Tentar novamente"
          onAction={() => window.location.reload()}
        />
      ) : null}
      {dashboardState === "empty" ? (
        <AppPageEmptyState
          title="Operação sem dados suficientes"
          description="Comece por cadastrar cliente, criar agendamento, abrir O.S. e registrar cobrança para ativar o centro de decisão."
        />
      ) : null}

      {dashboardState !== "loading" && dashboardState !== "error" && dashboardState !== "empty" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <AppSectionBlock
            title="Atenção imediata"
            subtitle="O que está errado agora, por severidade, com ação objetiva."
            className="xl:col-span-12"
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {immediateAttention.map(item => (
                <article
                  key={item.title}
                  className="flex min-h-[188px] flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                    <AppStatusBadge label={item.severity === "critical" ? "Urgente" : "Atenção"} />
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">{item.context}</p>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">Impacto: {item.impact}</p>
                  <Button className="mt-auto" size="sm" onClick={() => navigate(item.primaryPath)}>
                    {item.primaryCtaLabel}
                  </Button>
                </article>
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Próxima melhor ação"
            subtitle="Recomendação principal para reduzir risco e acelerar execução agora."
            className="xl:col-span-12"
          >
            <article className="rounded-lg border border-[var(--dashboard-danger)]/35 bg-[color-mix(in_srgb,var(--dashboard-danger)_8%,var(--surface-subtle))] p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{nextBestAction.action}</p>
              <p className="mt-1.5 text-xs text-[var(--text-secondary)]">Motivo: {nextBestAction.reason}</p>
              <p className="mt-1.5 text-xs text-[var(--text-secondary)]">Impacto esperado: {nextBestAction.impact}</p>
              <Button className="mt-3" size="sm" onClick={() => navigate(nextBestAction.ctaPath)}>
                {nextBestAction.ctaLabel}
              </Button>
            </article>
          </AppSectionBlock>

          <AppSectionBlock
            title="KPIs operacionais"
            subtitle="Quatro indicadores com leitura rápida, tendência e destino claro."
            className="xl:col-span-12"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <AppStatCard
                label="Receita do período"
                value="R$ 187,4k"
                helper="↓ 4,2% vs. semana passada · inadimplência em alta."
                delta={<Button size="sm" variant="ghost" onClick={() => navigate("/finances?view=revenue")}>Ver receita</Button>}
              />
              <AppStatCard
                label="Ordens abertas"
                value="18"
                helper="2 atrasadas · SLA no limite do turno."
                delta={<Button size="sm" variant="ghost" onClick={() => navigate("/service-orders?status=open")}>Abrir O.S.</Button>}
              />
              <AppStatCard
                label="Cobranças pendentes"
                value="21"
                helper="6 vencidas · gargalo principal do fluxo."
                delta={<Button size="sm" variant="ghost" onClick={() => navigate("/finances?view=charges&status=overdue")}>Cobranças</Button>}
              />
              <AppStatCard
                label="Ticket médio"
                value="R$ 892"
                helper="↑ 3,1% vs. último ciclo · manter margem."
                delta={<Button size="sm" variant="ghost" onClick={() => navigate("/finances?view=performance")}>Ver ticket</Button>}
              />
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Fluxo operacional"
            subtitle="Cliente → Agendamento → O.S. → Cobrança → Pagamento com leitura contínua."
            className="xl:col-span-12"
          >
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
              {operationalPipeline.map(step => (
                <article
                  key={step.stage}
                  className="flex min-h-[178px] flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">{step.stage}</p>
                  <p className="mt-2 text-3xl font-semibold leading-none text-[var(--text-primary)]">{step.volume}</p>
                  <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{step.microcontext}</p>
                  <Button size="sm" className="mt-auto" variant="outline" onClick={() => navigate(step.path)}>
                    {step.action}
                  </Button>
                </article>
              ))}
            </div>
            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              Gargalo principal: Cobrança → Pagamento. Ação sugerida: acelerar carteira vencida antes do fechamento.
            </p>
          </AppSectionBlock>

          <AppSectionBlock
            title="Fila operacional"
            subtitle="Itens priorizados por urgência para execução imediata."
            className="xl:col-span-8"
          >
            <div className="space-y-2.5">
              {operationalQueue.map(item => (
                <article key={`${item.type}-${item.entity}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{item.type}</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{item.entity}</p>
                    </div>
                    <AppStatusBadge label={item.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-[var(--text-secondary)]">Prazo: {item.deadline}</p>
                    <Button size="sm" variant="outline" onClick={() => navigate(item.path)}>
                      {item.actionLabel}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Pulso da operação"
            subtitle="Leitura interpretativa curta dos sinais do turno."
            className="xl:col-span-4"
          >
            <div className="space-y-2.5">
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-[var(--dashboard-warning)]" />
                <p className="text-xs text-[var(--text-secondary)]">Atraso médio em O.S. subiu para 38min e já compromete a janela da manhã.</p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <TrendingDown className="mt-0.5 h-4 w-4 text-[var(--dashboard-danger)]" />
                <p className="text-xs text-[var(--text-secondary)]">Cobrança está travando conversão para pagamento no ponto final do fluxo.</p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <MessageSquareWarning className="mt-0.5 h-4 w-4 text-[var(--dashboard-danger)]" />
                <p className="text-xs text-[var(--text-secondary)]">Mensagens falhadas cresceram e elevam risco de no-show em agendamentos críticos.</p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 text-[var(--dashboard-info)]" />
                <p className="text-xs text-[var(--text-secondary)]">Risco operacional permanece concentrado em agenda e financeiro neste turno.</p>
              </div>
            </div>
          </AppSectionBlock>
        </div>
      ) : null}
    </AppPageShell>
  );
}
