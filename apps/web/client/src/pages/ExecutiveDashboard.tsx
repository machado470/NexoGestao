import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowRight, Clock3, MessageSquareWarning, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/useRunAction";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import {
  AppKpiRow,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageHeader,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";

type DashboardState = "healthy" | "alert" | "critical" | "empty" | "error" | "loading";
type Severity = "critical" | "high" | "medium";

const severityWeight: Record<Severity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

const operationalPeriodLabel = "Hoje · Turno 08:00–18:00";

const immediateAttentionItems = [
  {
    severity: "critical" as const,
    title: "Cobranças vencidas em lote crítico",
    context: "6 cobranças vencidas há +48h no fechamento do caixa do dia.",
    impact: "Risco direto de estrangulamento de caixa e atraso de repasses.",
    owner: "Financeiro · Ana",
    primaryCtaLabel: "Cobrar agora",
    primaryPath: "/finances?view=charges&status=overdue",
    secondaryCtaLabel: "Ver carteira",
    secondaryPath: "/finances?view=charges",
  },
  {
    severity: "critical" as const,
    title: "O.S. atrasadas em rota ativa",
    context: "2 O.S. estão paradas há mais de 2h após início previsto.",
    impact: "Propaga atraso para agenda do dia e degrada SLA.",
    owner: "Operações · Bruno",
    primaryCtaLabel: "Destravar O.S.",
    primaryPath: "/service-orders?status=attention",
    secondaryCtaLabel: "Ver timeline",
    secondaryPath: "/timeline?severity=critical",
  },
  {
    severity: "high" as const,
    title: "Agendamentos sem confirmação",
    context: "4 clientes ainda sem confirmação para a próxima janela de execução.",
    impact: "Risco de ociosidade operacional e quebra de previsibilidade.",
    owner: "Agenda · Camila",
    primaryCtaLabel: "Confirmar agenda",
    primaryPath: "/appointments?status=pending-confirmation",
    secondaryCtaLabel: "Ajustar agenda",
    secondaryPath: "/appointments?view=calendar",
  },
  {
    severity: "high" as const,
    title: "Falha de comunicação WhatsApp",
    context: "5 mensagens de confirmação falharam na última hora.",
    impact: "Sem notificação, aumenta ausência em agendamento e retrabalho.",
    owner: "Comunicação · Júlia",
    primaryCtaLabel: "Resolver falhas",
    primaryPath: "/timeline?type=whatsapp-failure",
    secondaryCtaLabel: "Reenviar mensagens",
    secondaryPath: "/customers?segment=needs-contact",
  },
  {
    severity: "medium" as const,
    title: "Clientes sem resposta pós-serviço",
    context: "3 clientes sem retorno após execução concluída nas últimas 24h.",
    impact: "Queda de recompra e menor taxa de confirmação futura.",
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
    status: "Atenção",
    bottleneck: "3 sem retorno",
    action: "Ativar follow-up",
    path: "/customers?segment=inactive",
  },
  {
    stage: "Agendamento",
    volume: 42,
    status: "Atenção",
    bottleneck: "4 sem confirmação",
    action: "Confirmar agenda",
    path: "/appointments?status=pending-confirmation",
  },
  {
    stage: "O.S.",
    volume: 28,
    status: "Em risco",
    bottleneck: "2 atrasadas",
    action: "Destravar execução",
    path: "/service-orders?status=attention",
  },
  {
    stage: "Cobrança",
    volume: 21,
    status: "Em risco",
    bottleneck: "6 vencidas",
    action: "Cobrar carteira",
    path: "/finances?view=charges&status=overdue",
  },
  {
    stage: "Pagamento",
    volume: 15,
    status: "Seguro",
    bottleneck: "Conversão estável",
    action: "Ver recebimentos",
    path: "/finances?view=paid",
  },
] as const;

const operationalQueue = [
  {
    type: "O.S. para iniciar",
    entity: "OS-7841 · Cliente Acácia",
    status: "Pendente",
    deadline: "09:30",
    owner: "Equipe Campo 2",
    actionLabel: "Iniciar O.S.",
    path: "/service-orders?status=pending",
  },
  {
    type: "Agendamento",
    entity: "AG-1992 · Clínica Viva",
    status: "Atenção",
    deadline: "10:00",
    owner: "Agenda",
    actionLabel: "Confirmar",
    path: "/appointments?status=pending-confirmation",
  },
  {
    type: "Cliente aguardando resposta",
    entity: "Marina Costa",
    status: "Em risco",
    deadline: "10:15",
    owner: "Relacionamento",
    actionLabel: "Responder",
    path: "/customers?segment=needs-contact",
  },
  {
    type: "Cobrança a cobrar",
    entity: "COB-9021 · R$ 4.280",
    status: "Urgente",
    deadline: "11:00",
    owner: "Financeiro",
    actionLabel: "Cobrar",
    path: "/finances?view=charges&status=overdue",
  },
  {
    type: "Pendência do dia",
    entity: "Falha WhatsApp · lote 14",
    status: "Atenção",
    deadline: "11:30",
    owner: "Comunicação",
    actionLabel: "Resolver",
    path: "/timeline?type=whatsapp-failure",
  },
];

const contextualQuickActions = [
  { label: "Cobrar cliente", path: "/finances?view=charges&status=overdue" },
  { label: "Abrir O.S.", path: "/service-orders/new" },
  { label: "Ajustar agenda", path: "/appointments?view=calendar" },
  { label: "Responder cliente", path: "/customers?segment=needs-contact" },
  { label: "Ver detalhe da timeline", path: "/timeline" },
  { label: "Resolver falha de comunicação", path: "/timeline?type=whatsapp-failure" },
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
    dashboardState === "critical"
      ? "Operação crítica"
      : dashboardState === "alert"
        ? "Operação em alerta"
        : dashboardState === "healthy"
          ? "Operação saudável"
          : dashboardState === "empty"
            ? "Operação sem dados"
            : dashboardState === "error"
              ? "Falha de leitura operacional"
              : "Carregando operação";

  const nextBestAction = {
    action: "Confirmar imediatamente 4 agendamentos da faixa 10:00–12:00",
    reason: "É o ponto de maior impacto imediato para proteger SLA e evitar ociosidade da equipe de campo.",
    impact: "Evita até 2 horas de capacidade ociosa e reduz risco de efeito cascata em O.S. e cobrança.",
    ctaLabel: "Executar confirmação",
    ctaPath: "/appointments?status=pending-confirmation",
    detailPath: "/dashboard/operations?filter=critical",
  };

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[RENDER PAGE] executive-dashboard-refactor-v1");
  }, []);

  return (
    <AppPageShell>
      <AppPageHeader
        title="Dashboard Operacional · NexoGestão"
        description={
          <span>
            Central de decisão do fluxo Cliente → Agendamento → O.S. → Cobrança → Pagamento → Timeline → Risco → Governança.
            <span className="ml-2 inline-flex">
              <AppStatusBadge label={operationStateLabel} />
            </span>
          </span>
        }
        secondaryActions={
          <Button variant="outline" onClick={() => navigate("/governance")}>Ver governança</Button>
        }
        cta={
          <Button onClick={() => void runAction(async () => navigate("/dashboard/operations?filter=critical"))}>
            Abrir fila prioritária
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
        <span className="rounded-md border border-[var(--border-subtle)] px-2 py-1">{operationalPeriodLabel}</span>
        <span className="rounded-md border border-[var(--border-subtle)] px-2 py-1">Estado geral: {operationStateLabel}</span>
      </div>

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
          description="Comece por: cadastrar cliente, criar agendamento, abrir O.S. e registrar cobrança para ativar a leitura operacional."
        />
      ) : null}

      {dashboardState !== "loading" && dashboardState !== "error" && dashboardState !== "empty" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <AppSectionBlock
            title="Atenção imediata"
            subtitle="Problemas urgentes ordenados por severidade e impacto operacional."
            className="xl:col-span-12"
          >
            <div className="space-y-2.5">
              {immediateAttention.map(item => (
                <div
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
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">Impacto: {item.impact}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Área responsável: {item.owner}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => navigate(item.primaryPath)}>{item.primaryCtaLabel}</Button>
                    {item.secondaryCtaLabel ? (
                      <Button size="sm" variant="outline" onClick={() => navigate(item.secondaryPath)}>
                        {item.secondaryCtaLabel}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Próxima melhor ação"
            subtitle="Se só houver uma ação agora, execute esta para proteger o fluxo operacional."
            className="xl:col-span-6"
          >
            <div className="rounded-lg border border-[var(--dashboard-danger)]/30 bg-[var(--surface-subtle)] p-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{nextBestAction.action}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Motivo: {nextBestAction.reason}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Impacto esperado: {nextBestAction.impact}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate(nextBestAction.ctaPath)}>{nextBestAction.ctaLabel}</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(nextBestAction.detailPath)}>
                  Ver detalhe operacional
                </Button>
              </div>
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="KPIs operacionais"
            subtitle="Indicadores de decisão com contexto e ação direta."
            className="xl:col-span-6"
          >
            <AppKpiRow
              gridClassName="grid-cols-1 sm:grid-cols-2"
              items={[
                { title: "Receita do período", value: "R$ 187,4k", delta: "+15,6%", trend: "up", hint: "Ainda com pressão de inadimplência.", ctaLabel: "Ver receita", onClick: () => navigate("/finances?view=revenue") },
                { title: "Ordens em aberto", value: "18", delta: "+2", trend: "up", hint: "2 atrasadas com risco de SLA.", ctaLabel: "Ver O.S.", onClick: () => navigate("/service-orders?status=open") },
                { title: "Agendamentos do dia", value: "42", delta: "-4", trend: "down", hint: "4 pendentes de confirmação.", ctaLabel: "Ver agenda", onClick: () => navigate("/appointments") },
                { title: "SLA / atraso médio", value: "92,8% · 38min", delta: "-1,4%", trend: "down", hint: "Atraso concentrado em 2 rotas.", ctaLabel: "Proteger SLA", onClick: () => navigate("/service-orders?status=attention") },
                { title: "Ticket médio", value: "R$ 1.511", delta: "+4,4%", trend: "up", hint: "Manter conversão pós-serviço.", ctaLabel: "Detalhar ticket", onClick: () => navigate("/finances?metric=average_ticket") },
                { title: "Cobranças pendentes", value: "21", delta: "+6", trend: "up", hint: "6 vencidas acima de 48h.", ctaLabel: "Cobrar carteira", onClick: () => navigate("/finances?view=charges") },
                { title: "Pagamentos recebidos", value: "15", delta: "+3", trend: "up", hint: "Conversão estabilizando no período.", ctaLabel: "Ver recebimentos", onClick: () => navigate("/finances?view=paid") },
                { title: "Taxa de confirmação", value: "90,5%", delta: "-2,3%", trend: "down", hint: "Queda puxada por WhatsApp falho.", ctaLabel: "Ajustar comunicação", onClick: () => navigate("/timeline?type=whatsapp-failure") },
              ]}
            />
          </AppSectionBlock>

          <AppSectionBlock
            title="Fluxo operacional"
            subtitle="Cliente → Agendamento → O.S. → Cobrança → Pagamento com volume, gargalo e ação sugerida."
            className="xl:col-span-12"
          >
            <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-5">
              {operationalFlow.map(step => (
                <li key={step.stage} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{step.stage}</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{step.volume}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">Gargalo: {step.bottleneck}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <AppStatusBadge label={step.status} />
                    <button
                      type="button"
                      onClick={() => navigate(step.path)}
                      className="text-xs font-medium text-[var(--text-secondary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
                    >
                      {step.action}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--text-secondary)]">
              Gargalo principal: Cobrança vencida e O.S. atrasada. Etapa crítica atual: O.S. com atraso em rota ativa. Ação sugerida: confirmar agenda crítica e destravar execução antes de abrir nova carga.
            </p>
          </AppSectionBlock>

          <AppSectionBlock
            title="Fila operacional"
            subtitle="Execução imediata ordenada por urgência, sem tabela gigante."
            className="xl:col-span-7"
          >
            <div className="space-y-2.5">
              {operationalQueue.map(item => (
                <div key={`${item.type}-${item.entity}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{item.type}</p>
                    <AppStatusBadge label={item.status} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">{item.entity}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">Prazo: {item.deadline} · Responsável: {item.owner}</p>
                  <Button className="mt-2" size="sm" variant="outline" onClick={() => navigate(item.path)}>
                    {item.actionLabel}
                  </Button>
                </div>
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Pulso da operação"
            subtitle="Leitura interpretativa do que mudou e o que isso significa agora."
            className="xl:col-span-5"
          >
            <div className="space-y-2.5">
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-[var(--dashboard-warning)]" />
                <p className="text-xs text-[var(--text-secondary)]">
                  Aumento de atrasos em O.S. significa risco de efeito cascata no SLA da manhã.
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <ArrowRight className="mt-0.5 h-4 w-4 text-[var(--dashboard-info)]" />
                <p className="text-xs text-[var(--text-secondary)]">
                  Queda na conversão para pagamento indica necessidade de atuar em cobrança no mesmo dia da execução.
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <MessageSquareWarning className="mt-0.5 h-4 w-4 text-[var(--dashboard-danger)]" />
                <p className="text-xs text-[var(--text-secondary)]">
                  Falhas em mensagens pioram tempo de resposta e aumentam clientes inativos.
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 text-[var(--dashboard-info)]" />
                <p className="text-xs text-[var(--text-secondary)]">
                  Risco operacional alto no financeiro e na agenda. Governança deve acompanhar com prioridade neste turno.
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--dashboard-warning)]" />
                <p className="text-xs text-[var(--text-secondary)]">
                  Timeline aponta aumento de eventos críticos; tratar causa-raiz evita retrabalho ao fim do dia.
                </p>
              </div>
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Acessos rápidos contextuais"
            subtitle="Atalhos acionáveis alinhados ao momento operacional atual."
            className="xl:col-span-12"
          >
            <div className="flex flex-wrap gap-2">
              {contextualQuickActions.map(action => (
                <Button key={action.label} size="sm" variant="outline" onClick={() => navigate(action.path)}>
                  {action.label}
                </Button>
              ))}
            </div>
          </AppSectionBlock>
        </div>
      ) : null}
    </AppPageShell>
  );
}
