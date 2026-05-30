import { useMemo } from "react";
import { ArrowRight, Clock3, MessageSquareWarning, ShieldAlert, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useRenderWatchdog } from "@/hooks/useRenderWatchdog";
import {
  AppOperationalHeader,
  AppPageEmptyState,
  AppPageErrorState,
  AppPageLoadingState,
  AppPageShell,
  AppSectionBlock,
  AppStatusBadge,
} from "@/components/internal-page-system";
import {
  buildWhatsAppExecutionPath,
  formatWhatsAppExecutionDate,
  whatsappActionLabel,
  type WhatsAppActionExecution,
} from "@/lib/whatsappActionExecution";

type DashboardRecord = Record<string, unknown>;
type Severity = "critical" | "high" | "medium";
type SignalSeverity = "CRITICAL" | "WARNING" | "INFO";
type OperationalSignal = {
  id: string;
  severity: SignalSeverity;
  area: string;
  title: string;
  summary?: string;
  impact?: string;
  suggestedAction?: string;
  serviceOrderId?: string | null;
  chargeId?: string | null;
  messageId?: string | null;
};
type NextBestActionSignal = OperationalSignal & { reason?: string };
type AttentionItem = {
  id: string;
  severity: Severity;
  title: string;
  reason: string;
  impact: string;
  ctaLabel: string;
  path: string;
};
type QueueItem = {
  id: string;
  type: string;
  entity: string;
  context: string;
  ctaLabel: string;
  path: string;
};
type FlowStage = { label: string; value: string; context: string; path: string; action: string };
type ComparisonKey = "revenueReceivedPct" | "completedServiceOrdersPct" | "overdueChargesPct" | "failedMessagesPct";
type QueueRecord = DashboardRecord & { id?: unknown; type?: unknown; title?: unknown; context?: unknown; amountCents?: unknown };

type DashboardAlerts = {
  overdueOrders?: { count?: number; items?: DashboardRecord[] };
  overdueCharges?: { count?: number; totalAmountCents?: number; items?: DashboardRecord[] };
  todayServices?: { count?: number; items?: DashboardRecord[] };
  customersWithPending?: { count?: number; items?: DashboardRecord[] };
  doneOrdersWithoutCharge?: { count?: number; totalAmountCents?: number; items?: DashboardRecord[] };
  operationalQueue?: QueueRecord[];
};

const severityWeight: Record<Severity, number> = { critical: 3, high: 2, medium: 1 };

function asRecord(value: unknown): DashboardRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as DashboardRecord) : {};
}

function asAlerts(value: unknown): DashboardAlerts {
  return asRecord(value) as DashboardAlerts;
}

function readNumber(record: DashboardRecord, key: string) {
  return typeof record[key] === "number" && Number.isFinite(record[key]) ? (record[key] as number) : 0;
}

function readNullableNumber(record: DashboardRecord, key: string) {
  return typeof record[key] === "number" && Number.isFinite(record[key]) ? (record[key] as number) : null;
}

function describeComparison(label: string, value: number | null, lowerIsBetter = false) {
  if (value === null) return `${label}: sem base histórica suficiente.`;
  if (value === 0) return `${label}: estável em relação ao período anterior.`;

  const improved = lowerIsBetter ? value < 0 : value > 0;
  return `${label}: ${improved ? "melhorou" : "piorou"} ${Math.abs(value).toLocaleString("pt-BR")}% em relação ao período anterior.`;
}

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
}

function formatPeriod() {
  return `Hoje · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}`;
}

function buildSignalPath(signal: Pick<OperationalSignal, "area" | "messageId" | "chargeId" | "serviceOrderId">) {
  if (signal.area === "WHATSAPP" || signal.messageId) return "/whatsapp";
  if (signal.area === "FINANCE" || signal.chargeId) return "/finances?view=charges";
  if (signal.serviceOrderId) return `/service-orders?id=${signal.serviceOrderId}`;
  if (signal.area === "GOVERNANCE" || signal.area === "RISK") return "/governance";
  return "/timeline";
}

function fromSignal(signal: OperationalSignal): AttentionItem {
  return {
    id: signal.id,
    severity: signal.severity === "CRITICAL" ? "critical" : signal.severity === "WARNING" ? "high" : "medium",
    title: signal.title,
    reason: signal.summary ?? "Sinal operacional retornado pelo backend.",
    impact: signal.impact ?? "O impacto precisa ser validado no módulo responsável.",
    ctaLabel: signal.suggestedAction ?? "Abrir contexto",
    path: buildSignalPath(signal),
  };
}

function buildAttention(alerts: DashboardAlerts, signals: OperationalSignal[]) {
  const items = signals.map(fromSignal);
  const add = (condition: number, item: Omit<AttentionItem, "id">) => {
    if (condition > 0) items.push({ id: `${item.path}-${item.title}`, ...item });
  };
  add(alerts.overdueOrders?.count ?? 0, {
    severity: "critical", title: "O.S. atrasadas exigem destravamento", reason: `${alerts.overdueOrders?.count} ordem(ns) passaram do prazo operacional.`, impact: "Atrasos ativos podem comprometer as próximas janelas de atendimento.", ctaLabel: "Revisar O.S. atrasadas", path: "/service-orders?status=attention",
  });
  add(alerts.overdueCharges?.count ?? 0, {
    severity: "critical", title: "Cobranças vencidas pressionam o caixa", reason: `${alerts.overdueCharges?.count} cobrança(s) vencida(s), somando ${formatCurrencyFromCents(alerts.overdueCharges?.totalAmountCents ?? 0)}.`, impact: "Recebimentos atrasados interrompem o fechamento financeiro do serviço.", ctaLabel: "Cobrar carteira vencida", path: "/finances?view=charges&status=overdue",
  });
  add(alerts.doneOrdersWithoutCharge?.count ?? 0, {
    severity: "high", title: "Serviços concluídos ainda não viraram cobrança", reason: `${alerts.doneOrdersWithoutCharge?.count} O.S. concluída(s) sem cobrança vinculada.`, impact: "Serviço entregue sem cobrança prolonga o ciclo até pagamento.", ctaLabel: "Fechar serviços concluídos", path: "/service-orders?status=done",
  });
  return items.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]).slice(0, 5);
}

function buildQueue(alerts: DashboardAlerts): QueueItem[] {
  return (alerts.operationalQueue ?? []).slice(0, 6).map(item => {
    const type = String(item.type);
    if (type === "OVERDUE_SERVICE_ORDER") return { id: String(item.id), type: "O.S. atrasada", entity: String(item.title ?? "Ordem de serviço"), context: String(item.context ?? "Prazo operacional vencido"), ctaLabel: "Destravar O.S.", path: `/service-orders?id=${String(item.id)}` };
    if (type === "OVERDUE_CHARGE") return { id: String(item.id), type: "Cobrança vencida", entity: String(item.title ?? "Cliente"), context: formatCurrencyFromCents(typeof item.amountCents === "number" ? item.amountCents : 0), ctaLabel: "Abrir cobrança", path: "/finances?view=charges&status=overdue" };
    if (type === "UNCONFIRMED_APPOINTMENT") return { id: String(item.id), type: "Agendamento sem confirmação", entity: String(item.title ?? "Agendamento do dia"), context: String(item.context ?? "Confirmação pendente"), ctaLabel: "Confirmar agenda", path: "/appointments?status=pending-confirmation" };
    return { id: String(item.id), type: "Mensagem com falha", entity: String(item.title ?? "Mensagem WhatsApp"), context: String(item.context ?? "Falha retornada pelo backend"), ctaLabel: "Resolver mensagem", path: "/whatsapp" };
  });
}

function AttentionRow({ item, navigate }: { item: AttentionItem; navigate: (path: string) => void }) {
  return <article className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3.5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><AppStatusBadge label={item.severity === "critical" ? "Urgente" : item.severity === "high" ? "Atenção" : "Monitorar"} /><p className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</p></div>
        <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Motivo: {item.reason}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Impacto: {item.impact}</p>
      </div>
      <Button size="sm" onClick={() => navigate(item.path)}>{item.ctaLabel}</Button>
    </div>
  </article>;
}

export default function ExecutiveDashboard() {
  useRenderWatchdog("ExecutiveDashboard");
  const [, navigate] = useLocation();
  const kpisQuery = trpc.dashboard.kpis.useQuery(undefined, { retry: false });
  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, { retry: false });
  const pendingWhatsAppApprovalsQuery = trpc.nexo.whatsapp.listPendingApprovals.useQuery({ limit: 10 }, { retry: false });
  const operationalSignalsQuery = useQuery({
    queryKey: ["internal-operational-signals"],
    queryFn: async () => { const response = await fetch("/internal/operational-signals?limit=8", { credentials: "include" }); if (!response.ok) throw new Error("signals fetch failed"); return (await response.json()) as { signals?: OperationalSignal[] }; }, retry: false,
  });
  const nextBestActionQuery = useQuery({
    queryKey: ["internal-operational-signals-next-best-action"],
    queryFn: async () => { const response = await fetch("/internal/operational-signals/next-best-action", { credentials: "include" }); if (!response.ok) throw new Error("next best action fetch failed"); return (await response.json()) as NextBestActionSignal | null; }, retry: false,
  });

  const metrics = useMemo(() => asRecord(kpisQuery.data), [kpisQuery.data]);
  const alerts = useMemo(() => asAlerts(alertsQuery.data), [alertsQuery.data]);
  const signals = operationalSignalsQuery.data?.signals ?? [];
  const attention = useMemo(() => buildAttention(alerts, signals), [alerts, signals]);
  const queue = useMemo(() => buildQueue(alerts), [alerts]);
  const pendingWhatsAppApprovals = Array.isArray(pendingWhatsAppApprovalsQuery.data) ? pendingWhatsAppApprovalsQuery.data as WhatsAppActionExecution[] : [];
  const pageLoading = kpisQuery.isLoading || alertsQuery.isLoading;
  const pageError = kpisQuery.isError || alertsQuery.isError;
  const comparison = asRecord(metrics.comparison);
  const pulseComparisons: Array<[string, ComparisonKey, boolean?]> = [
    ["Receita recebida", "revenueReceivedPct"],
    ["O.S. concluídas", "completedServiceOrdersPct"],
    ["Cobranças vencidas", "overdueChargesPct", true],
    ["Mensagens falhando", "failedMessagesPct", true],
  ];
  const criticalCount = attention.filter(item => item.severity === "critical").length;
  const operationState = pageError ? "Leitura operacional indisponível" : criticalCount > 0 ? `${criticalCount} risco(s) crítico(s) ativo(s)` : attention.length > 0 ? `${attention.length} ponto(s) pedem atenção` : "Sem riscos ativos retornados";

  const flow: FlowStage[] = [
    { label: "Cliente", value: String(readNumber(metrics, "totalCustomers")), context: "clientes ativos", path: "/customers", action: "Ver clientes" },
    { label: "Agendamento", value: String(alerts.todayServices?.count ?? 0), context: "agendamentos hoje", path: "/appointments", action: "Ver agenda" },
    { label: "O.S.", value: String(readNumber(metrics, "openServiceOrders")), context: "ordens abertas", path: "/service-orders", action: "Ver execução" },
    { label: "Cobrança", value: String(readNumber(metrics, "chargesGenerated")), context: "cobranças geradas", path: "/finances?view=charges", action: "Ver cobranças" },
    { label: "Pagamento", value: readNullableNumber(metrics, "paymentsReceivedCount") === null ? "—" : String(readNullableNumber(metrics, "paymentsReceivedCount")), context: readNullableNumber(metrics, "paymentsReceivedCount") === null ? "volume não disponível no contrato" : "pagamentos recebidos nesta semana", path: "/finances?view=paid", action: "Ver pagamentos" },
  ];
  const overdueOrders = alerts.overdueOrders?.count ?? 0;
  const overdueCharges = alerts.overdueCharges?.count ?? 0;
  const missingCharges = alerts.doneOrdersWithoutCharge?.count ?? 0;
  const bottleneck = overdueCharges >= overdueOrders && overdueCharges >= missingCharges && overdueCharges > 0
    ? { label: "Cobrança → Pagamento", action: "Priorizar cobranças vencidas", path: "/finances?view=charges&status=overdue" }
    : overdueOrders > 0 ? { label: "Agendamento → O.S.", action: "Destravar O.S. atrasadas", path: "/service-orders?status=attention" }
    : missingCharges > 0 ? { label: "O.S. → Cobrança", action: "Gerar cobranças pendentes", path: "/service-orders?status=done" }
    : null;
  const nextBestAction = nextBestActionQuery.data;
  const hasOperationalData = Object.keys(metrics).length > 0 || attention.length > 0 || queue.length > 0;

  return <AppPageShell className="space-y-4">
    <AppOperationalHeader title="Centro de decisão operacional" description="Priorize o que destrava a operação antes de navegar pelos módulos." contextChips={<><AppStatusBadge label={formatPeriod()} /><AppStatusBadge label={operationState} /></>} />

    {pageLoading ? <AppPageLoadingState title="Carregando mesa de comando" description="Buscando riscos, fila e indicadores operacionais reais." /> : null}
    {pageError ? <AppPageErrorState title="Não foi possível ler a operação" description="Falhou a consulta de métricas ou alertas. O dashboard não assume que está tudo bem quando a leitura está indisponível." onAction={() => { void kpisQuery.refetch(); void alertsQuery.refetch(); }} /> : null}
    {!pageLoading && !pageError && !hasOperationalData ? <AppPageEmptyState title="Ainda não há dados operacionais para priorizar" description="Cadastre clientes, agendamentos, O.S. e cobranças. O dashboard não cria alertas ou recomendações fictícias para preencher este espaço." /> : null}

    {!pageLoading && !pageError && hasOperationalData ? <>
      <AppSectionBlock title="Atenção imediata" subtitle="Até 5 riscos ordenados por severidade, cada um com um próximo passo.">
        {attention.length > 0 ? <div className="space-y-2.5">{attention.map(item => <AttentionRow key={item.id} item={item} navigate={navigate} />)}</div> : <AppPageEmptyState title="Nenhum alerta operacional retornado" description="A leitura foi concluída sem riscos ativos. Continue acompanhando a fila operacional." />}
      </AppSectionBlock>

      <AppSectionBlock title="Próxima Melhor Ação" subtitle="Recomendação específica retornada pelo endpoint operacional existente.">
        {nextBestActionQuery.isLoading ? <AppPageLoadingState title="Buscando próxima ação" description="Consultando o priorizador operacional." /> : nextBestActionQuery.isError ? <AppPageErrorState title="Próxima ação indisponível" description="O priorizador não respondeu. Revise a atenção imediata e tente novamente." onAction={() => void nextBestActionQuery.refetch()} /> : nextBestAction ? <article className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{nextBestAction.title}</p>
          <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Motivo: {nextBestAction.reason ?? nextBestAction.summary ?? "Prioridade indicada pelo motor operacional."}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Impacto: {nextBestAction.impact ?? "Valide o impacto no módulo responsável antes de executar."}</p>
          <Button className="mt-4" size="sm" onClick={() => navigate(buildSignalPath(nextBestAction))}>{nextBestAction.suggestedAction ?? "Abrir ação prioritária"}<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </article> : <AppPageEmptyState title="Nenhuma Próxima Melhor Ação disponível" description="O backend não retornou uma recomendação operacional agora. Use a atenção imediata e a fila; nenhuma ação artificial foi criada." />}
      </AppSectionBlock>

      <AppSectionBlock title="KPIs operacionais" subtitle="Poucos indicadores com contexto e destino útil.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            ["Receita recebida", formatCurrencyFromCents(readNumber(metrics, "paidRevenueInCents")), "Valor recebido acumulado exposto pelo backend.", "Ver pagamentos", "/finances?view=paid"],
            ["O.S. abertas", String(readNumber(metrics, "openServiceOrders")), overdueOrders > 0 ? `${overdueOrders} atrasada(s) exigem avanço.` : "Sem O.S. atrasadas retornadas.", "Abrir execução", "/service-orders?status=open"],
            ["Cobranças vencidas", String(overdueCharges), overdueCharges > 0 ? `${formatCurrencyFromCents(alerts.overdueCharges?.totalAmountCents ?? 0)} aguardando recebimento.` : "Sem cobrança vencida retornada.", "Abrir cobranças", "/finances?view=charges&status=overdue"],
            ["Mensagens falhando", String(readNumber(asRecord(metrics.whatsappSignals), "failedMessages")), "Falhas podem interromper confirmação e retorno ao cliente.", "Revisar WhatsApp", "/whatsapp"],
          ].map(([label, value, context, cta, path]) => <article key={label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4"><p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p><p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{value}</p><p className="mt-2 min-h-10 text-xs leading-5 text-[var(--text-secondary)]">{context}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => navigate(path)}>{cta}</Button></article>)}
        </div>
      </AppSectionBlock>

      <AppSectionBlock title="Fluxo operacional" subtitle="Cliente → Agendamento → O.S. → Cobrança → Pagamento. Volumes disponíveis sem completar lacunas com estimativas.">
        <div className="grid gap-2 md:grid-cols-5">{flow.map(stage => <article key={stage.label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3"><p className="text-xs text-[var(--text-muted)]">{stage.label}</p><p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{stage.value}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{stage.context}</p><Button className="mt-3 px-0" variant="link" size="sm" onClick={() => navigate(stage.path)}>{stage.action}</Button></article>)}</div>
        <div className="mt-3 rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)]">{bottleneck ? <>Gargalo principal: <strong className="text-[var(--text-primary)]">{bottleneck.label}</strong>. <Button variant="link" size="sm" onClick={() => navigate(bottleneck.path)}>{bottleneck.action}</Button></> : "Nenhum gargalo foi identificado com os dados disponíveis."}</div>
      </AppSectionBlock>

      <AppSectionBlock title="Fila operacional" subtitle="Lista curta de itens acionáveis; não é uma tabela exaustiva.">
        {queue.length > 0 ? <div className="grid gap-2 md:grid-cols-2">{queue.map(item => <article key={`${item.type}-${item.id}`} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3"><p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">{item.type}</p><p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{item.entity}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{item.context}</p><Button className="mt-2" variant="outline" size="sm" onClick={() => navigate(item.path)}>{item.ctaLabel}</Button></article>)}</div> : <AppPageEmptyState title="Fila operacional sem itens retornados" description="Não há itens acionáveis na leitura atual. O dashboard não preenche a fila com exemplos." />}
      </AppSectionBlock>

      <AppSectionBlock title="Pulso da operação" subtitle="Leitura humana baseada nos sinais disponíveis neste momento.">
        <div className="grid gap-2 md:grid-cols-2">
          {pulseComparisons.map(([label, key, lowerIsBetter]) => <p key={key} className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)]"><TrendingDown className="mr-2 inline h-4 w-4" />{describeComparison(label, readNullableNumber(comparison, key), lowerIsBetter)}</p>)}
          <p className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)]"><ShieldAlert className="mr-2 inline h-4 w-4" />Principal risco: {bottleneck?.label ?? "nenhum gargalo identificado com a leitura disponível"}.</p>
          <p className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)]"><Clock3 className="mr-2 inline h-4 w-4" />Execução: {overdueOrders > 0 ? `${overdueOrders} O.S. atrasada(s) precisam avançar primeiro.` : "sem atraso de O.S. retornado."}</p>
          <p className="rounded-lg border border-[var(--border-subtle)] p-3 text-sm text-[var(--text-secondary)]"><MessageSquareWarning className="mr-2 inline h-4 w-4" />Comunicação: {readNumber(asRecord(metrics.whatsappSignals), "failedMessages")} mensagem(ns) com falha retornada(s).</p>
        </div>
      </AppSectionBlock>

      <AppSectionBlock title="Acessos rápidos contextuais" subtitle="Atalhos para continuar a decisão nos módulos responsáveis.">
        <div className="flex flex-wrap gap-2">{[["Financeiro em atraso", "/finances?view=charges&status=overdue"], ["O.S. com atenção", "/service-orders?status=attention"], ["Agenda sem confirmação", "/appointments?status=pending-confirmation"], ["WhatsApp operacional", "/whatsapp"]].map(([label, path]) => <Button key={path} variant="outline" size="sm" onClick={() => navigate(path)}>{label}</Button>)}</div>
        <div className="mt-4 border-t border-[var(--border-subtle)] pt-4"><p className="text-sm font-semibold text-[var(--text-primary)]">Aprovações WhatsApp · {pendingWhatsAppApprovals.length}</p>{pendingWhatsAppApprovalsQuery.isError ? <p className="mt-2 text-xs text-[var(--danger)]">Não foi possível carregar aprovações WhatsApp no dashboard.</p> : pendingWhatsAppApprovals.length > 0 ? <div className="mt-2 space-y-2">{pendingWhatsAppApprovals.slice(0, 2).map(execution => <button type="button" key={execution.id} className="block w-full rounded-lg border border-[var(--border-subtle)] p-3 text-left text-xs text-[var(--text-secondary)]" onClick={() => navigate(buildWhatsAppExecutionPath(execution))}>{whatsappActionLabel(execution.suggestedAction)} · {formatWhatsAppExecutionDate(execution.createdAt)}</button>)}</div> : <p className="mt-2 text-xs text-[var(--text-muted)]">Nenhuma aprovação pendente retornada.</p>}</div>
      </AppSectionBlock>
    </> : null}
  </AppPageShell>;
}
