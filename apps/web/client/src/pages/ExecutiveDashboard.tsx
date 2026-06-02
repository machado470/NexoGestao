import { useMemo } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  CreditCard,
  MessageSquareWarning,
  ShieldAlert,
  TrendingDown,
  Zap,
  UserRound,
  WalletCards,
} from "lucide-react";
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
type FlowStage = {
  label: string;
  value: string;
  context: string;
  path: string;
  action: string;
};
type RecommendedAction = {
  title: string;
  reason: string;
  impact: string;
  path: string;
  ctaLabel: string;
};
type ComparisonKey =
  | "revenueReceivedPct"
  | "completedServiceOrdersPct"
  | "overdueChargesPct"
  | "failedMessagesPct";
type QueueRecord = DashboardRecord & {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  context?: unknown;
  amountCents?: unknown;
};

type DashboardAlerts = {
  overdueOrders?: { count?: number; items?: DashboardRecord[] };
  overdueCharges?: {
    count?: number;
    totalAmountCents?: number;
    items?: DashboardRecord[];
  };
  todayServices?: { count?: number; items?: DashboardRecord[] };
  customersWithPending?: { count?: number; items?: DashboardRecord[] };
  doneOrdersWithoutCharge?: {
    count?: number;
    totalAmountCents?: number;
    items?: DashboardRecord[];
  };
  operationalQueue?: QueueRecord[];
};

const severityWeight: Record<Severity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

function asRecord(value: unknown): DashboardRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DashboardRecord)
    : {};
}

function asAlerts(value: unknown): DashboardAlerts {
  return asRecord(value) as DashboardAlerts;
}

function readNumber(record: DashboardRecord, key: string) {
  return typeof record[key] === "number" && Number.isFinite(record[key])
    ? (record[key] as number)
    : 0;
}

function readNullableNumber(record: DashboardRecord, key: string) {
  return typeof record[key] === "number" && Number.isFinite(record[key])
    ? (record[key] as number)
    : null;
}

function describeComparison(
  label: string,
  value: number,
  lowerIsBetter = false
) {
  if (value === 0) return `${label}: estável em relação ao período anterior.`;

  const improved = lowerIsBetter ? value < 0 : value > 0;
  return `${label}: ${improved ? "melhorou" : "piorou"} ${Math.abs(value).toLocaleString("pt-BR")}% em relação ao período anterior.`;
}

function formatCurrencyFromCents(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function formatCurrencyMentions(value: string) {
  return value.replace(/(\d+)\s+centavos\b/gi, (_, cents: string) =>
    formatCurrencyFromCents(Number(cents))
  );
}

function formatPeriod() {
  return `Hoje · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}`;
}

function buildSignalPath(
  signal: Pick<
    OperationalSignal,
    "area" | "messageId" | "chargeId" | "serviceOrderId"
  >
) {
  if (signal.area === "WHATSAPP" || signal.messageId) return "/whatsapp";
  if (signal.area === "FINANCE" || signal.chargeId)
    return "/finances?view=charges";
  if (signal.serviceOrderId)
    return `/service-orders?id=${signal.serviceOrderId}`;
  if (signal.area === "GOVERNANCE" || signal.area === "RISK")
    return "/governance";
  return "/timeline";
}

function fromSignal(signal: OperationalSignal): AttentionItem {
  return {
    id: signal.id,
    severity:
      signal.severity === "CRITICAL"
        ? "critical"
        : signal.severity === "WARNING"
          ? "high"
          : "medium",
    title: formatCurrencyMentions(signal.title),
    reason: formatCurrencyMentions(
      signal.summary ?? "Sinal operacional retornado pelo backend."
    ),
    impact: formatCurrencyMentions(
      signal.impact ?? "O impacto precisa ser validado no módulo responsável."
    ),
    ctaLabel: signal.suggestedAction ?? "Abrir contexto",
    path: buildSignalPath(signal),
  };
}

function buildAttention(alerts: DashboardAlerts, signals: OperationalSignal[]) {
  const items = signals.map(fromSignal);
  const add = (condition: number, item: Omit<AttentionItem, "id">) => {
    if (condition > 0)
      items.push({ id: `${item.path}-${item.title}`, ...item });
  };
  add(alerts.overdueOrders?.count ?? 0, {
    severity: "critical",
    title: "O.S. atrasadas exigem destravamento",
    reason: `${alerts.overdueOrders?.count} ordem(ns) passaram do prazo operacional.`,
    impact:
      "Atrasos ativos podem comprometer as próximas janelas de atendimento.",
    ctaLabel: "Revisar O.S. atrasadas",
    path: "/service-orders?status=attention",
  });
  add(alerts.overdueCharges?.count ?? 0, {
    severity: "critical",
    title: "Cobranças vencidas pressionam o caixa",
    reason: `${alerts.overdueCharges?.count} cobrança(s) vencida(s), somando ${formatCurrencyFromCents(alerts.overdueCharges?.totalAmountCents ?? 0)}.`,
    impact:
      "Recebimentos atrasados interrompem o fechamento financeiro do serviço.",
    ctaLabel: "Cobrar carteira vencida",
    path: "/finances?view=charges&status=overdue",
  });
  add(alerts.doneOrdersWithoutCharge?.count ?? 0, {
    severity: "high",
    title: "Serviços concluídos ainda não viraram cobrança",
    reason: `${alerts.doneOrdersWithoutCharge?.count} O.S. concluída(s) sem cobrança vinculada.`,
    impact: "Serviço entregue sem cobrança prolonga o ciclo até pagamento.",
    ctaLabel: "Fechar serviços concluídos",
    path: "/service-orders?status=done",
  });
  return items
    .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])
    .slice(0, 5);
}

function buildQueue(alerts: DashboardAlerts): QueueItem[] {
  return (alerts.operationalQueue ?? []).slice(0, 6).map(item => {
    const type = String(item.type);
    if (type === "OVERDUE_SERVICE_ORDER")
      return {
        id: String(item.id),
        type: "O.S. atrasada",
        entity: String(item.title ?? "Ordem de serviço"),
        context: formatCurrencyMentions(
          String(item.context ?? "Prazo operacional vencido")
        ),
        ctaLabel: "Destravar",
        path: `/service-orders?id=${String(item.id)}`,
      };
    if (type === "OVERDUE_CHARGE")
      return {
        id: String(item.id),
        type: "Cobrança vencida",
        entity: String(item.title ?? "Cliente"),
        context: `${formatCurrencyFromCents(
          typeof item.amountCents === "number" ? item.amountCents : 0
        )} · ${formatCurrencyMentions(String(item.context ?? "Prazo financeiro vencido"))}`,
        ctaLabel: "Cobrar",
        path: "/finances?view=charges&status=overdue",
      };
    if (type === "CUSTOMER_AWAITING_RESPONSE")
      return {
        id: String(item.id),
        type: "Cliente aguardando resposta",
        entity: String(item.title ?? "Conversa WhatsApp"),
        context: formatCurrencyMentions(
          String(item.context ?? "Conversa aguardando resposta da operação")
        ),
        ctaLabel: "Responder cliente",
        path: "/whatsapp",
      };
    if (type === "UNCONFIRMED_APPOINTMENT")
      return {
        id: String(item.id),
        type: "Agendamento sem confirmação",
        entity: String(item.title ?? "Agendamento futuro"),
        context: formatCurrencyMentions(
          String(item.context ?? "Confirmação pendente")
        ),
        ctaLabel: "Confirmar agenda",
        path: "/appointments",
      };
    return {
      id: String(item.id),
      type: "Mensagem com falha",
      entity: String(item.title ?? "Mensagem WhatsApp"),
      context: formatCurrencyMentions(
        String(item.context ?? "Falha retornada pelo backend")
      ),
      ctaLabel: "Resolver mensagem",
      path: "/whatsapp",
    };
  });
}

function AttentionRow({
  item,
  navigate,
}: {
  item: AttentionItem;
  navigate: (path: string) => void;
}) {
  return (
    <article className="relative py-2.5 pl-6 first:pt-0 last:pb-0">
      <ShieldAlert className="absolute left-0 top-3 h-4 w-4 text-[var(--danger)] first:top-0" />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AppStatusBadge
              label={
                item.severity === "critical"
                  ? "Risco crítico"
                  : item.severity === "high"
                    ? "Atenção"
                    : "Monitorar"
              }
            />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {item.title}
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            <strong>Motivo:</strong> {item.reason}
          </p>
          <p className="text-xs leading-5 text-[var(--text-muted)]">
            <strong>Impacto:</strong> {item.impact}
          </p>
        </div>
        <Button
          className="w-full shrink-0 md:w-auto"
          size="sm"
          onClick={() => navigate(item.path)}
        >
          {item.ctaLabel}
        </Button>
      </div>
    </article>
  );
}

export default function ExecutiveDashboard() {
  useRenderWatchdog("ExecutiveDashboard");
  const [, navigate] = useLocation();
  const kpisQuery = trpc.dashboard.kpis.useQuery(undefined, { retry: false });
  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    retry: false,
  });
  const pendingWhatsAppApprovalsQuery =
    trpc.nexo.whatsapp.listPendingApprovals.useQuery(
      { limit: 10 },
      { retry: false }
    );
  const operationalSignalsQuery = useQuery({
    queryKey: ["internal-operational-signals"],
    queryFn: async () => {
      const response = await fetch("/internal/operational-signals?limit=8", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("signals fetch failed");
      return (await response.json()) as { signals?: OperationalSignal[] };
    },
    retry: false,
  });
  const nextBestActionQuery = useQuery({
    queryKey: ["internal-operational-signals-next-best-action"],
    queryFn: async () => {
      const response = await fetch(
        "/internal/operational-signals/next-best-action",
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("next best action fetch failed");
      return (await response.json()) as NextBestActionSignal | null;
    },
    retry: false,
  });

  const metrics = useMemo(() => asRecord(kpisQuery.data), [kpisQuery.data]);
  const alerts = useMemo(() => asAlerts(alertsQuery.data), [alertsQuery.data]);
  const signals = operationalSignalsQuery.data?.signals ?? [];
  const attention = useMemo(
    () => buildAttention(alerts, signals),
    [alerts, signals]
  );
  const queue = useMemo(() => buildQueue(alerts), [alerts]);
  const pendingWhatsAppApprovals = Array.isArray(
    pendingWhatsAppApprovalsQuery.data
  )
    ? (pendingWhatsAppApprovalsQuery.data as WhatsAppActionExecution[])
    : [];
  const pageLoading = kpisQuery.isLoading || alertsQuery.isLoading;
  const pageError = kpisQuery.isError || alertsQuery.isError;
  const comparison = asRecord(metrics.comparison);
  const pulseComparisons: Array<[string, ComparisonKey, boolean?]> = [
    ["Receita recebida", "revenueReceivedPct"],
    ["O.S. concluídas", "completedServiceOrdersPct"],
    ["Cobranças vencidas", "overdueChargesPct", true],
    ["Mensagens falhando", "failedMessagesPct", true],
  ];
  const criticalCount = attention.filter(
    item => item.severity === "critical"
  ).length;
  const operationState = pageError
    ? "Crítico"
    : criticalCount > 0
      ? "Crítico"
      : attention.length > 0
        ? "Atenção"
        : "Normal";

  const flow: FlowStage[] = [
    {
      label: "Cliente",
      value: String(readNumber(metrics, "totalCustomers")),
      context: "clientes ativos",
      path: "/customers",
      action: "Ver clientes",
    },
    {
      label: "Agendamento",
      value: String(alerts.todayServices?.count ?? 0),
      context: "agendamentos hoje",
      path: "/appointments",
      action: "Ver agenda",
    },
    {
      label: "O.S.",
      value: String(readNumber(metrics, "openServiceOrders")),
      context: "ordens abertas",
      path: "/service-orders",
      action: "Ver execução",
    },
    {
      label: "Cobrança",
      value: String(readNumber(metrics, "chargesGenerated")),
      context: "cobranças geradas",
      path: "/finances?view=charges",
      action: "Ver cobranças",
    },
    {
      label: "Pagamento",
      value:
        readNullableNumber(metrics, "paymentsReceivedCount") === null
          ? "—"
          : String(readNullableNumber(metrics, "paymentsReceivedCount")),
      context:
        readNullableNumber(metrics, "paymentsReceivedCount") === null
          ? "volume não disponível no contrato"
          : "pagamentos recebidos nesta semana",
      path: "/finances?view=paid",
      action: "Ver pagamentos",
    },
  ];
  const overdueOrders = alerts.overdueOrders?.count ?? 0;
  const overdueCharges = alerts.overdueCharges?.count ?? 0;
  const missingCharges = alerts.doneOrdersWithoutCharge?.count ?? 0;
  const bottleneck =
    overdueCharges >= overdueOrders &&
    overdueCharges >= missingCharges &&
    overdueCharges > 0
      ? {
          label: "Cobrança → Pagamento",
          action: "Priorizar cobranças vencidas",
          path: "/finances?view=charges&status=overdue",
        }
      : overdueOrders > 0
        ? {
            label: "Agendamento → O.S.",
            action: "Destravar O.S. atrasadas",
            path: "/service-orders?status=attention",
          }
        : missingCharges > 0
          ? {
              label: "O.S. → Cobrança",
              action: "Gerar cobranças pendentes",
              path: "/service-orders?status=done",
            }
          : null;
  const failedMessages = readNumber(
    asRecord(metrics.whatsappSignals),
    "failedMessages"
  );
  const nextBestAction = nextBestActionQuery.data;
  const fallbackAction: RecommendedAction | null =
    overdueCharges > 0
      ? {
          title: "Cobrar carteira vencida",
          reason: `${overdueCharges} cobrança(s) vencida(s) aguardam tratamento.`,
          impact:
            "A recuperação da carteira reduz pressão imediata sobre o caixa.",
          path: "/finances?view=charges&status=overdue",
          ctaLabel: "Cobrar carteira vencida",
        }
      : overdueOrders > 0
        ? {
            title: "Revisar O.S. atrasadas",
            reason: `${overdueOrders} O.S. atrasada(s) precisam avançar.`,
            impact:
              "Destravar a execução protege as próximas janelas de atendimento.",
            path: "/service-orders?status=attention",
            ctaLabel: "Revisar O.S. atrasadas",
          }
        : failedMessages > 0
          ? {
              title: "Revisar WhatsApp",
              reason: `${failedMessages} mensagem(ns) com falha podem interromper o contato com clientes.`,
              impact:
                "Restabelecer a comunicação evita perda de confirmações e retornos.",
              path: "/whatsapp",
              ctaLabel: "Revisar WhatsApp",
            }
          : null;
  const recommendedAction: RecommendedAction | null = nextBestAction
    ? {
        title: formatCurrencyMentions(nextBestAction.title),
        reason: formatCurrencyMentions(
          nextBestAction.reason ??
            nextBestAction.summary ??
            "Prioridade indicada pelo motor operacional."
        ),
        impact: formatCurrencyMentions(
          nextBestAction.impact ??
            "Valide o impacto no módulo responsável antes de executar."
        ),
        path: buildSignalPath(nextBestAction),
        ctaLabel: nextBestAction.suggestedAction ?? "Abrir ação prioritária",
      }
    : fallbackAction;
  const availableComparisons = pulseComparisons.flatMap(
    ([label, key, lowerIsBetter]) => {
      const value = readNullableNumber(comparison, key);
      return value === null
        ? []
        : [describeComparison(label, value, lowerIsBetter)];
    }
  );
  const missingComparisonCount =
    pulseComparisons.length - availableComparisons.length;
  const hasOperationalData =
    Object.keys(metrics).length > 0 || attention.length > 0 || queue.length > 0;
  const bottleneckStage = bottleneck?.label.split(" → ")[0] ?? "Fluxo";
  const kpiCards = [
    {
      label: "Caixa recebido",
      value: formatCurrencyFromCents(readNumber(metrics, "paidRevenueInCents")),
      context: "Entrada financeira registrada.",
      cta: "Ver pagamentos",
      path: "/finances?view=paid",
      Icon: WalletCards,
    },
    {
      label: "Execução em aberto",
      value: String(readNumber(metrics, "openServiceOrders")),
      context:
        overdueOrders > 0
          ? `${overdueOrders} atrasada(s) exigem avanço.`
          : "Sem atraso retornado.",
      cta: "Abrir execução",
      path: "/service-orders?status=open",
      Icon: ClipboardList,
    },
    {
      label: "Caixa em risco",
      value: formatCurrencyFromCents(
        alerts.overdueCharges?.totalAmountCents ?? 0
      ),
      context:
        overdueCharges > 0
          ? `${overdueCharges} cobrança(s) vencida(s).`
          : "Sem carteira vencida retornada.",
      cta: "Abrir cobranças",
      path: "/finances?view=charges&status=overdue",
      Icon: CircleDollarSign,
    },
    {
      label: "Falhas de comunicação",
      value: String(failedMessages),
      context:
        failedMessages > 0
          ? "Falhas podem bloquear confirmações."
          : "Sem falhas retornadas.",
      cta: "Revisar WhatsApp",
      path: "/whatsapp",
      Icon: MessageSquareWarning,
    },
  ];

  const quickAccesses = [
    {
      label: "Financeiro em atraso",
      path: "/finances?view=charges&status=overdue",
      Icon: CircleDollarSign,
    },
    {
      label: "O.S. com atenção",
      path: "/service-orders?status=attention",
      Icon: ClipboardList,
    },
    {
      label: "Agenda sem confirmação",
      path: "/appointments?status=pending-confirmation",
      Icon: CalendarClock,
    },
    {
      label: "WhatsApp operacional",
      path: "/whatsapp",
      Icon: MessageSquareWarning,
    },
  ];
  const pulseInsights = [
    {
      label: "Prioridade",
      Icon: ShieldAlert,
      iconClass: bottleneck
        ? "text-[var(--accent-primary)]"
        : "text-[var(--text-muted)]",
      text: bottleneck
        ? `${bottleneck.label} concentra a principal quebra do fluxo.`
        : "Pipeline sem quebra ativa; acompanhe a fila antes de redistribuir o time.",
    },
    {
      label: "Capacidade",
      Icon: Clock3,
      iconClass:
        overdueOrders > 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]",
      text:
        overdueOrders > 0
          ? `${overdueOrders} O.S. atrasada(s) indicam pressão na execução.`
          : "Execução sem atraso retornado; preserve o ritmo das próximas janelas.",
    },
    {
      label: "Contato",
      Icon: MessageSquareWarning,
      iconClass:
        failedMessages > 0
          ? "text-[var(--danger)]"
          : "text-[var(--text-muted)]",
      text:
        failedMessages > 0
          ? `${failedMessages} falha(s) podem quebrar confirmações e retorno ao cliente.`
          : "Nenhuma falha retornada; o canal não bloqueia o fluxo agora.",
    },
    {
      label: "Caixa",
      Icon: WalletCards,
      iconClass:
        overdueCharges > 0
          ? "text-[var(--accent-primary)]"
          : "text-[var(--text-muted)]",
      text:
        overdueCharges > 0
          ? `${formatCurrencyFromCents(alerts.overdueCharges?.totalAmountCents ?? 0)} vencidos prolongam o ciclo até recebimento.`
          : "Sem vencimentos retornados; caixa não exige reação imediata.",
    },
  ];
  return (
    <AppPageShell className="space-y-4 bg-[radial-gradient(circle_at_top_right,color-mix(in_srgb,var(--accent-primary)_7%,transparent),transparent_36%),linear-gradient(145deg,color-mix(in_srgb,var(--surface-subtle)_92%,transparent),var(--surface-base))]">
      <AppOperationalHeader
        className="border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-subtle)_88%,transparent)] px-4 !py-2.5"
        density="compact"
        title="Operação hoje"
        description="Decida primeiro o que destrava execução e caixa."
        contextChips={
          <>
            <span className="text-xs text-[var(--text-muted)]">
              {formatPeriod()}
            </span>
            <AppStatusBadge label={`Estado: ${operationState}`} />
            <span
              className={`text-xs font-medium ${criticalCount > 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}
            >
              {criticalCount}{" "}
              {criticalCount === 1 ? "risco crítico" : "riscos críticos"}
            </span>
          </>
        }
      />

      {pageLoading ? (
        <AppPageLoadingState
          title="Carregando mesa de comando"
          description="Buscando riscos, fila e indicadores operacionais reais."
        />
      ) : null}
      {pageError ? (
        <AppPageErrorState
          title="Não foi possível ler a operação"
          description="Falhou a consulta de métricas ou alertas. O dashboard não assume que está tudo bem quando a leitura está indisponível."
          onAction={() => {
            void kpisQuery.refetch();
            void alertsQuery.refetch();
          }}
        />
      ) : null}
      {!pageLoading && !pageError && !hasOperationalData ? (
        <AppPageEmptyState
          title="Ainda não há dados operacionais para priorizar"
          description="Cadastre clientes, agendamentos, O.S. e cobranças. O dashboard não cria alertas ou recomendações fictícias para preencher este espaço."
        />
      ) : null}

      {!pageLoading && !pageError && hasOperationalData ? (
        <>
          <AppSectionBlock
            title="Atenção imediata"
            className="border-[color-mix(in_srgb,var(--danger)_42%,var(--border-subtle))] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--danger)_5%,var(--surface-base)),var(--surface-base))]"
            subtitle="Comece aqui: riscos que interrompem execução, recebimento ou atendimento, em ordem de severidade."
          >
            {attention.length > 0 ? (
              <div className="divide-y divide-[var(--border-subtle)]">
                {attention.map(item => (
                  <AttentionRow key={item.id} item={item} navigate={navigate} />
                ))}
              </div>
            ) : (
              <AppPageEmptyState
                title="Nenhum alerta operacional retornado"
                description="A leitura foi concluída sem riscos ativos. Continue acompanhando a fila operacional."
              />
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Próxima melhor ação"
            className="border-[color-mix(in_srgb,var(--accent-primary)_44%,var(--border-subtle))] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--accent-primary)_7%,var(--surface-base)),var(--surface-base))]"
            subtitle="Uma decisão principal para converter a leitura operacional em avanço imediato."
          >
            {recommendedAction ? (
              <div className="flex flex-col gap-4 py-0.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <AppStatusBadge label="Aguardando ação" />
                    <Zap className="h-4 w-4 text-[var(--accent-primary)]" />
                    <p className="text-lg font-semibold text-[var(--text-primary)]">
                      {recommendedAction.title}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-5 text-[var(--text-secondary)]">
                    <strong>Por que agora:</strong> {recommendedAction.reason}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    <strong>Efeito esperado:</strong> {recommendedAction.impact}
                  </p>
                </div>
                <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:shrink-0 lg:justify-end">
                  {nextBestActionQuery.isError ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void nextBestActionQuery.refetch()}
                    >
                      Tentar novamente
                    </Button>
                  ) : null}
                  <Button
                    className="w-full bg-[var(--accent-primary)] text-[var(--on-accent)] hover:bg-[color-mix(in_srgb,var(--accent-primary)_88%,var(--text-primary))] sm:w-auto"
                    onClick={() => navigate(recommendedAction.path)}
                  >
                    {recommendedAction.ctaLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <AppPageEmptyState
                title="Nenhuma Próxima Melhor Ação disponível"
                description="A leitura atual não identificou urgências acionáveis; nenhuma ação artificial foi criada."
              />
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="KPIs operacionais"
            compact
            className="bg-[color-mix(in_srgb,var(--surface-subtle)_62%,var(--surface-base))]"
            subtitle="Poucos indicadores com contexto e destino útil."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {kpiCards.map(({ label, value, context, cta, path, Icon }) => (
                <article
                  key={label}
                  className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-subtle)_74%,transparent)] px-3.5 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      {label}
                    </p>
                    <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  </div>
                  <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
                    {value}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {context}
                  </p>
                  <Button
                    className="mt-1 px-0 text-[var(--accent-primary)]"
                    variant="link"
                    size="sm"
                    onClick={() => navigate(path)}
                  >
                    {cta}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </article>
              ))}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Fluxo operacional"
            className="border-[color-mix(in_srgb,var(--accent-primary)_28%,var(--border-subtle))] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--surface-subtle)_82%,transparent),var(--surface-base))]"
            subtitle="Cliente → Agendamento → O.S. → Cobrança → Pagamento"
          >
            <div
              className={`mb-3 rounded-lg px-3 py-2 text-sm ${bottleneck ? "border border-[color-mix(in_srgb,var(--accent-primary)_42%,var(--border-subtle))] bg-[color-mix(in_srgb,var(--accent-primary)_8%,var(--surface-subtle))] text-[var(--text-secondary)]" : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]"}`}
            >
              {bottleneck ? (
                <>
                  <strong className="text-[var(--accent-primary)]">
                    {bottleneckStage} · Gargalo principal · {bottleneck.label}
                  </strong>
                  <span className="mx-2 text-[var(--text-muted)]">—</span>
                  <Button
                    className="px-0"
                    variant="link"
                    size="sm"
                    onClick={() => navigate(bottleneck.path)}
                  >
                    {bottleneck.action}
                  </Button>
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 inline h-4 w-4" />
                  Nenhum gargalo foi identificado com os dados disponíveis.
                </>
              )}
            </div>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {flow.map((stage, index) => {
                const isBreak = bottleneck?.label.startsWith(stage.label);
                const StageIcon = [
                  UserRound,
                  CalendarClock,
                  ClipboardList,
                  CircleDollarSign,
                  CreditCard,
                ][index];
                return (
                  <article
                    key={stage.label}
                    className={`relative min-w-0 rounded-lg border px-3 py-2.5 ${isBreak ? "border-[var(--accent-primary)] bg-[color-mix(in_srgb,var(--accent-primary)_8%,var(--surface-subtle))]" : "border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-subtle)_54%,transparent)]"}`}
                  >
                    {isBreak ? (
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-primary)]">
                        Gargalo principal
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <StageIcon
                          className={`h-4 w-4 shrink-0 ${isBreak ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`}
                        />
                        <p
                          className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${isBreak ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`}
                        >
                          {stage.label}
                        </p>
                      </div>
                      {index < flow.length - 1 ? (
                        <ChevronRight
                          className={`hidden h-4 w-4 lg:block ${isBreak ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"}`}
                        />
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-xl font-semibold text-[var(--text-primary)]">
                      {stage.value}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                      {stage.context}
                    </p>
                    <Button
                      className="mt-1 px-0"
                      variant="link"
                      size="sm"
                      onClick={() => navigate(stage.path)}
                    >
                      {stage.action}
                    </Button>
                  </article>
                );
              })}
            </div>
          </AppSectionBlock>

          <AppSectionBlock
            title="Fila operacional"
            compact
            subtitle="Lista curta para execução direta."
          >
            {queue.length > 0 ? (
              <div>
                <div className="grid gap-2 md:grid-cols-2">
                  {queue.map(item => (
                    <article
                      key={`${item.type}-${item.id}`}
                      className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-subtle)_58%,transparent)] p-3"
                    >
                      <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        {item.type}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                        {item.entity}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                        {item.context}
                      </p>
                      <Button
                        className="mt-1 px-0"
                        variant="link"
                        size="sm"
                        onClick={() => navigate(item.path)}
                      >
                        {item.ctaLabel}
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </article>
                  ))}
                </div>
                <Button
                  className="mt-1 px-0"
                  variant="link"
                  size="sm"
                  onClick={() => navigate("/timeline")}
                >
                  Ver todas as pendências
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <AppPageEmptyState
                title="Fila operacional sem itens retornados"
                description="Não há itens acionáveis na leitura atual. O dashboard não preenche a fila com exemplos."
              />
            )}
          </AppSectionBlock>

          <AppSectionBlock
            title="Pulso da operação"
            compact
            subtitle="Interpretação dos sinais para orientar a decisão."
          >
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {pulseInsights.map(({ label, Icon, iconClass, text }) => (
                <article
                  key={label}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-subtle)_68%,transparent)] p-3 text-sm leading-5 text-[var(--text-secondary)]"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--surface-base)_82%,transparent)]">
                      <Icon className={`h-4 w-4 ${iconClass}`} />
                    </span>
                    <strong className="text-[var(--text-primary)]">
                      {label}
                    </strong>
                  </div>
                  <p>{text}</p>
                </article>
              ))}
            </div>
            {availableComparisons.length > 0 || missingComparisonCount > 0 ? (
              <div className="mt-3 border-t border-[var(--border-subtle)] pt-2 text-xs leading-5 text-[var(--text-muted)]">
                {availableComparisons.map(item => (
                  <p key={item}>
                    <TrendingDown className="mr-1.5 inline h-3.5 w-3.5" />
                    {item}
                  </p>
                ))}
                {missingComparisonCount > 0 ? (
                  <p className="mt-1">
                    Histórico em formação: sem base histórica suficiente para{" "}
                    {missingComparisonCount} de {pulseComparisons.length}{" "}
                    indicador(es).
                  </p>
                ) : null}
              </div>
            ) : null}
          </AppSectionBlock>

          <AppSectionBlock
            title="Acessos rápidos contextuais"
            compact
            subtitle="Navegação secundária para continuar a decisão."
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {quickAccesses.map(({ label, path, Icon }) => (
                <button
                  type="button"
                  key={path}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-subtle)_52%,transparent)] px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
                  onClick={() => navigate(path)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                    <span>{label}</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[color-mix(in_srgb,var(--surface-subtle)_48%,transparent)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Aprovações WhatsApp · {pendingWhatsAppApprovals.length}
                </p>
                <Button
                  className="px-0 text-[var(--accent-primary)]"
                  variant="link"
                  size="sm"
                  onClick={() => navigate("/whatsapp")}
                >
                  Abrir aprovações
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
              {pendingWhatsAppApprovalsQuery.isError ? (
                <p className="mt-2 text-xs text-[var(--danger)]">
                  Não foi possível carregar aprovações WhatsApp no dashboard.
                </p>
              ) : pendingWhatsAppApprovals.length > 0 ? (
                <div className="mt-1 divide-y divide-[var(--border-subtle)]">
                  {pendingWhatsAppApprovals.slice(0, 2).map(execution => (
                    <button
                      type="button"
                      key={execution.id}
                      className="flex w-full items-center justify-between gap-3 py-2 text-left text-xs text-[var(--text-secondary)]"
                      onClick={() =>
                        navigate(buildWhatsAppExecutionPath(execution))
                      }
                    >
                      <span>
                        {whatsappActionLabel(execution.suggestedAction)} ·{" "}
                        {formatWhatsAppExecutionDate(execution.createdAt)}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Nenhuma aprovação pendente retornada.
                </p>
              )}
            </div>
          </AppSectionBlock>
        </>
      ) : null}
    </AppPageShell>
  );
}
