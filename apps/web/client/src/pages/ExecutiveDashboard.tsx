import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Clock3, MessageSquareWarning, ShieldAlert, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    owner: "Financeiro · Ana",
    primaryCtaLabel: "Cobrar agora",
    primaryPath: "/finances?view=charges&status=overdue",
    secondaryCtaLabel: "Ver carteira",
    secondaryPath: "/finances?view=charges",
  },
  {
    severity: "critical" as const,
    title: "O.S. atrasadas em rota ativa",
    context: "2 O.S. paradas há mais de 2h após início previsto.",
    impact: "Degrada SLA e empurra atraso para os próximos slots.",
    owner: "Operações · Bruno",
    primaryCtaLabel: "Destravar O.S.",
    primaryPath: "/service-orders?status=attention",
    secondaryCtaLabel: "Ver timeline",
    secondaryPath: "/timeline?severity=critical",
  },
  {
    severity: "high" as const,
    title: "Agendamentos sem confirmação",
    context: "4 clientes sem confirmação para a janela 10:00–12:00.",
    impact: "Risco de ociosidade operacional e quebra de previsibilidade.",
    owner: "Agenda · Camila",
    primaryCtaLabel: "Confirmar agenda",
    primaryPath: "/appointments?status=pending-confirmation",
    secondaryCtaLabel: "Ajustar agenda",
    secondaryPath: "/appointments?view=calendar",
  },
  {
    severity: "high" as const,
    title: "Falhas em mensagens de confirmação",
    context: "5 mensagens de WhatsApp falharam na última hora.",
    impact: "Aumenta ausência em agendamento e retrabalho.",
    owner: "Comunicação · Júlia",
    primaryCtaLabel: "Resolver falhas",
    primaryPath: "/timeline?type=whatsapp-failure",
    secondaryCtaLabel: "Reenviar mensagens",
    secondaryPath: "/customers?segment=needs-contact",
  },
  {
    severity: "medium" as const,
    title: "Clientes sem resposta pós-serviço",
    context: "3 clientes sem retorno após execução nas últimas 24h.",
    impact: "Reduz recompra e confirmação futura.",
    owner: "Relacionamento · Time CS",
    primaryCtaLabel: "Responder cliente",
    primaryPath: "/customers?segment=inactive",
    secondaryCtaLabel: "Abrir detalhe",
    secondaryPath: "/timeline?type=customer-follow-up",
  },
];

const operationalFlow = [
  {
    stage: "Cliente",
    volume: 138,
    conversion: "→ Agendamento 30,4%",
    bottleneck: "3 sem retorno",
    status: "Atenção",
    action: "Ativar follow-up",
    path: "/customers?segment=inactive",
  },
  {
    stage: "Agendamento",
    volume: 42,
    conversion: "→ O.S. 66,7%",
    bottleneck: "4 sem confirmação",
    status: "Atenção",
    action: "Confirmar agenda",
    path: "/appointments?status=pending-confirmation",
  },
  {
    stage: "O.S.",
    volume: 28,
    conversion: "→ Cobrança 75%",
    bottleneck: "2 atrasadas",
    status: "Em risco",
    action: "Destravar execução",
    path: "/service-orders?status=attention",
  },
  {
    stage: "Cobrança",
    volume: 21,
    conversion: "→ Pagamento 71,4%",
    bottleneck: "6 vencidas",
    status: "Crítico",
    action: "Cobrar carteira",
    path: "/finances?view=charges&status=overdue",
  },
  {
    stage: "Pagamento",
    volume: 15,
    conversion: "Meta 80%",
    bottleneck: "Conversão abaixo da meta",
    status: "Atenção",
    action: "Ver recebimentos",
    path: "/finances?view=paid",
  },
] as const;

const operationalQueue = [
  {
    type: "Cobrança",
    entity: "COB-9021 · R$ 4.280",
    status: "Urgente",
    deadline: "11:00",
    owner: "Financeiro",
    actionLabel: "Cobrar",
    path: "/finances?view=charges&status=overdue",
  },
  {
    type: "O.S.",
    entity: "OS-7841 · Cliente Acácia",
    status: "Atenção",
    deadline: "09:30",
    owner: "Equipe Campo 2",
    actionLabel: "Iniciar O.S.",
    path: "/service-orders?status=pending",
  },
  {
    type: "Agendamento",
    entity: "AG-1992 · Clínica Viva",
    status: "Pendente",
    deadline: "10:00",
    owner: "Agenda",
    actionLabel: "Confirmar",
    path: "/appointments?status=pending-confirmation",
  },
  {
    type: "Atendimento",
    entity: "Marina Costa · sem retorno",
    status: "Em risco",
    deadline: "10:15",
    owner: "Relacionamento",
    actionLabel: "Responder",
    path: "/customers?segment=needs-contact",
  },
  {
    type: "Comunicação",
    entity: "Falha WhatsApp · lote 14",
    status: "Atenção",
    deadline: "11:30",
    owner: "Comunicação",
    actionLabel: "Resolver",
    path: "/timeline?type=whatsapp-failure",
  },
];

const contextualQuickActions = [
  { label: "Clientes", path: "/customers" },
  { label: "Agendamentos", path: "/appointments" },
  { label: "O.S.", path: "/service-orders" },
  { label: "Financeiro", path: "/finances" },
  { label: "WhatsApp", path: "/timeline?type=whatsapp-failure" },
  { label: "Timeline", path: "/timeline" },
  { label: "Governança", path: "/governance" },
];

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
    () => [...immediateAttentionItems].sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]).slice(0, 5),
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
    action: "Confirmar agora os 4 agendamentos pendentes da janela 10:00–12:00",
    reason: "Esse ponto evita ociosidade de equipe e reduz o efeito cascata de atraso em O.S. e cobrança.",
    impact: "Protege até 2h de capacidade de campo e melhora a conversão de agenda para execução ainda no turno.",
    ctaLabel: "Executar confirmação",
    ctaPath: "/appointments?status=pending-confirmation",
    detailPath: "/dashboard/operations?filter=critical",
  };

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] executive-dashboard-v2-operational-center");
  }, []);

  return (
    <AppPageShell>
      <AppOperationalHeader
        title="Centro de decisão operacional"
        description="Leitura rápida: atenção imediata, próxima ação e KPIs operacionais em uma passada."
        secondaryActions={<Button variant="outline" onClick={() => navigate("/governance")}>Ver governança</Button>}
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
            subtitle="Problemas urgentes com responsável e ação."
            className="xl:col-span-12"
          >
            <div className="space-y-2.5">
              {immediateAttention.map(item => (
                <article
                  key={item.title}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                    <AppStatusBadge
                      label={item.severity === "critical" ? "Urgente" : item.severity === "high" ? "Atenção" : "Monitorar"}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.context}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Responsável: {item.owner}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => navigate(item.primaryPath)}>{item.primaryCtaLabel}</Button>
                    <Button size="sm" variant="outline" onClick={() => navigate(item.secondaryPath)}>
                      {item.secondaryCtaLabel}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Próxima melhor ação"
            subtitle="Ação dominante do turno."
            className="xl:col-span-12"
          >
            <article className="rounded-lg border border-[var(--dashboard-danger)]/30 bg-[var(--surface-subtle)] p-3.5">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{nextBestAction.action}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Motivo: {nextBestAction.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate(nextBestAction.ctaPath)}>{nextBestAction.ctaLabel}</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(nextBestAction.detailPath)}>
                  Ver detalhe
                </Button>
              </div>
            </article>
          </AppSectionBlock>

          <AppSectionBlock
            title="KPIs operacionais"
            subtitle="4 KPIs em uma linha, sem conteúdo espremido."
            className="xl:col-span-12"
          >
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <AppStatCard
                label="Receita do período"
                value="R$ 187,4k"
                helper="Inadimplência pressiona caixa."
                delta={<Button size="sm" variant="ghost" onClick={() => navigate("/finances?view=revenue")}>Ver receita</Button>}
              />
              <AppStatCard
                label="Ordens em aberto"
                value="18"
                helper="2 atrasadas com risco de SLA."
                delta={<Button size="sm" variant="ghost" onClick={() => navigate("/service-orders?status=open")}>Abrir O.S.</Button>}
              />
              <AppStatCard
                label="Agendamentos do dia"
                value="42"
                helper="4 pendentes de confirmação."
                delta={<Button size="sm" variant="ghost" onClick={() => navigate("/appointments")}>Ver agenda</Button>}
              />
              <AppStatCard
                label="SLA / atraso médio"
                value="92,8% · 38min"
                helper="2 rotas concentram atraso."
                delta={<Button size="sm" variant="ghost" onClick={() => navigate("/service-orders?status=attention")}>Proteger SLA</Button>}
              />
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Fluxo operacional"
            subtitle="Cliente → Agendamento → O.S. → Cobrança → Pagamento."
            className="xl:col-span-12"
          >
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              {operationalFlow.slice(0, 4).map((step, index) => (
                <article key={step.stage} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{step.stage}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{step.volume}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{step.bottleneck}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <AppStatusBadge label={step.conversion} />
                    <Button size="sm" variant="ghost" onClick={() => navigate(step.path)}>
                      {step.action}
                    </Button>
                  </div>
                  {index < 3 ? <p className="mt-2 text-right text-xs text-[var(--text-muted)]">→</p> : null}
                </article>
              ))}
            </div>
            <article className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Etapa crítica consolidada · {operationalFlow[4].stage}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                {operationalFlow[4].bottleneck}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {operationalFlow[4].conversion} · {operationalFlow[4].status}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => navigate(operationalFlow[4].path)}
              >
                {operationalFlow[4].action}
              </Button>
            </article>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">Gargalo atual: Cobrança → Pagamento.</p>
          </AppSectionBlock>

          <AppSectionBlock
            title="Fila operacional"
            subtitle="Execução imediata."
            className="xl:col-span-7"
          >
            <div className="space-y-2.5">
              {operationalQueue.map(item => (
                <article key={`${item.type}-${item.entity}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{item.type}</p>
                    <AppStatusBadge label={item.status} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">{item.entity}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">Prazo: {item.deadline} · Responsável: {item.owner}</p>
                  <Button className="mt-2" size="sm" variant="outline" onClick={() => navigate(item.path)}>
                    {item.actionLabel}
                  </Button>
                </article>
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Pulso da operação"
            subtitle="Sinais do turno."
            className="xl:col-span-5"
          >
            <div className="space-y-2.5">
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-[var(--dashboard-warning)]" />
                <p className="text-xs text-[var(--text-secondary)]">Atrasos em O.S. subiram e já pressionam a janela da manhã. Priorize destravar execução.</p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <TrendingDown className="mt-0.5 h-4 w-4 text-[var(--dashboard-danger)]" />
                <p className="text-xs text-[var(--text-secondary)]">A conversão de cobrança para pagamento caiu para 71,4%, abaixo da meta de 80%.</p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <MessageSquareWarning className="mt-0.5 h-4 w-4 text-[var(--dashboard-danger)]" />
                <p className="text-xs text-[var(--text-secondary)]">Falhas de mensagem aumentam no-show e pioram o tempo de resposta ao cliente.</p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 text-[var(--dashboard-info)]" />
                <p className="text-xs text-[var(--text-secondary)]">Risco operacional concentra em agenda e financeiro; governança deve acompanhar este turno.</p>
              </div>
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Acessos rápidos contextuais"
            subtitle="Atalhos enxutos para navegar por decisão, sem duplicar menu global."
            className="xl:col-span-12"
          >
            <div className="flex flex-wrap gap-2">
              {contextualQuickActions.map(action => (
                <Button key={action.label} size="sm" variant="outline" onClick={() => navigate(action.path)}>
                  {action.label}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              ))}
            </div>
          </AppSectionBlock>
        </div>
      ) : null}
    </AppPageShell>
  );
}
