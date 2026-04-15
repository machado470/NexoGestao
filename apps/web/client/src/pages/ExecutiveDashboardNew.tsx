import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { AppPageHeader, AppPageShell, AppSectionCard } from "@/components/app-system";
import { Button } from "@/components/ui/button";
import { useActionHandler } from "@/hooks/useActionHandler";
import { AppLoadingState } from "@/components/app";
import {
  buildBottleneckGroups,
  buildNextActions,
  getOperationalStateSummary,
} from "@/lib/operations/operational-hub";
import { formatDelta, getDayWindow, getWindow, inRange, percentDelta, safeDate, trendFromDelta } from "@/lib/operational/kpi";
import { setBootPhase } from "@/lib/bootPhase";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

function toArray<T>(payload: unknown): T[] {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;
  return Array.isArray(raw) ? (raw as T[]) : [];
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function messagesInRange(items: any[], start: Date, end: Date) {
  return items
    .filter((item) => String(item?.status ?? "").toUpperCase() === "PAID")
    .reduce((acc, item) => {
      const date = safeDate(item?.paidAt ?? item?.updatedAt);
      if (!inRange(date, start, end)) return acc;
      return acc + Number(item?.amountCents ?? 0);
    }, 0);
}

function CompactActionItem({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--border)]/70 bg-[var(--surface)] px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{title}</p>
        <p className="line-clamp-2 text-xs text-[var(--text-muted)]">{description}</p>
      </div>
      <Button variant="ghost" size="sm" className="h-7 shrink-0 whitespace-nowrap px-2.5 text-xs" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}

export default function ExecutiveDashboardNew() {
  setBootPhase("PAGE:ExecutiveDashboard");
  const { isAuthenticated, isInitializing } = useAuth();
  const [, navigate] = useLocation();
  const { executeAction } = useActionHandler();
  const [isExecutingNext, setIsExecutingNext] = useState(false);
  const canQuery = isAuthenticated && !isInitializing;

  const governanceSummaryQuery = trpc.governance.summary.useQuery(undefined, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });

  const appointments = useMemo(() => toArray<any>(appointmentsQuery.data), [appointmentsQuery.data]);
  const serviceOrders = useMemo(() => toArray<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);
  const charges = useMemo(() => toArray<any>(chargesQuery.data), [chargesQuery.data]);
  const customers = useMemo(() => toArray<any>(customersQuery.data), [customersQuery.data]);

  const currentMonth = getWindow(30, 0);
  const previousMonth = getWindow(30, 1);
  const todayWindow = getDayWindow(0);
  const yesterdayWindow = getDayWindow(1);

  const sentCurrent = messagesInRange(charges, currentMonth.start, currentMonth.end);
  const sentPrevious = messagesInRange(charges, previousMonth.start, previousMonth.end);

  const paidCurrentCount = charges.filter(
    (item) => String(item?.status ?? "").toUpperCase() === "PAID" && inRange(safeDate(item?.paidAt ?? item?.updatedAt), currentMonth.start, currentMonth.end)
  ).length;
  const paidPreviousCount = charges.filter(
    (item) => String(item?.status ?? "").toUpperCase() === "PAID" && inRange(safeDate(item?.paidAt ?? item?.updatedAt), previousMonth.start, previousMonth.end)
  ).length;

  const ticketCurrent = paidCurrentCount > 0 ? sentCurrent / paidCurrentCount : 0;
  const ticketPrevious = paidPreviousCount > 0 ? sentPrevious / paidPreviousCount : 0;

  const ordersOpen = serviceOrders.filter((item) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(String(item?.status ?? "").toUpperCase())).length;
  const ordersOpenCurrent = serviceOrders.filter(
    (item) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(String(item?.status ?? "").toUpperCase()) && inRange(safeDate(item?.updatedAt), currentMonth.start, currentMonth.end)
  ).length;
  const ordersOpenPrevious = serviceOrders.filter(
    (item) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(String(item?.status ?? "").toUpperCase()) && inRange(safeDate(item?.updatedAt), previousMonth.start, previousMonth.end)
  ).length;

  const slaEligible = serviceOrders.filter((item) => ["IN_PROGRESS", "DONE"].includes(String(item?.status ?? "").toUpperCase()));
  const slaOnTrack = slaEligible.filter((item) => Number(item?.delayedMinutes ?? 0) <= 0).length;
  const slaCurrent = slaEligible.length ? (slaOnTrack / slaEligible.length) * 100 : 100;

  const slaEligiblePrev = serviceOrders.filter(
    (item) =>
      ["IN_PROGRESS", "DONE"].includes(String(item?.status ?? "").toUpperCase()) &&
      inRange(safeDate(item?.updatedAt), previousMonth.start, previousMonth.end)
  );
  const slaOnTrackPrev = slaEligiblePrev.filter((item) => Number(item?.delayedMinutes ?? 0) <= 0).length;
  const slaPrevious = slaEligiblePrev.length ? (slaOnTrackPrev / slaEligiblePrev.length) * 100 : slaCurrent;

  const appointmentsToday = appointments.filter(item => inRange(safeDate(item?.startsAt), todayWindow.start, todayWindow.end)).length;
  const appointmentsYesterday = appointments.filter(item => inRange(safeDate(item?.startsAt), yesterdayWindow.start, yesterdayWindow.end)).length;

  const overdueCharges = charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE").length;
  const doneWithoutCharge = serviceOrders.filter(item => String(item?.status ?? "").toUpperCase() === "DONE" && !item?.financialSummary?.hasCharge).length;
  const overdueAppointments = appointments.filter(item => String(item?.status ?? "").toUpperCase() === "NO_SHOW").length;

  const operationalState = useMemo(
    () =>
      getOperationalStateSummary({
        overdueCharges,
        doneWithoutCharge,
        overdueAppointments,
        failedWhatsAppMessages: 0,
        governanceState: (governanceSummaryQuery.data as any)?.data?.operationalState,
      }),
    [doneWithoutCharge, governanceSummaryQuery.data, overdueAppointments, overdueCharges]
  );

  const nextActions = useMemo(
    () =>
      buildNextActions({
        customers,
        appointments,
        serviceOrders,
        charges,
      }).slice(0, 5),
    [appointments, charges, customers, serviceOrders]
  );

  const bottlenecks = useMemo(() => buildBottleneckGroups({ appointments, serviceOrders, charges }), [appointments, charges, serviceOrders]);

  const opportunities = [
    `${pipelinePotential(serviceOrders)} O.S. prontas para faturar hoje`,
    `${overdueCharges} cobranças vencidas com recuperação rápida`,
    `${appointments.filter(item => String(item?.status ?? "").toUpperCase() === "CONFIRMED").length} agendamentos confirmados com potencial de conversão`,
  ];

  const executeNextAction = async () => {
    const nextAction = nextActions[0];
    if (!nextAction?.executionAction) {
      toast.message("Sem próxima ação executável no momento.");
      return;
    }

    setIsExecutingNext(true);
    const result = await executeAction(nextAction.executionAction);
    await Promise.all([
      appointmentsQuery.refetch(),
      serviceOrdersQuery.refetch(),
      chargesQuery.refetch(),
      customersQuery.refetch(),
      governanceSummaryQuery.refetch(),
    ]);

    if (result.ok) {
      toast.success("Próxima ação executada. Estado operacional recalculado.");
    }
    setIsExecutingNext(false);
  };

  if (governanceSummaryQuery.isLoading) {
    return (
      <AppPageShell>
        <AppLoadingState rows={6} />
      </AppPageShell>
    );
  }

  const kpis = [
    {
      label: "Receita",
      value: formatCurrency(sentCurrent),
      description: "últimos 30 dias",
      variation: formatDelta(percentDelta(sentCurrent, sentPrevious)),
      trend: trendFromDelta(percentDelta(sentCurrent, sentPrevious)),
      onOpen: () => navigate("/finances"),
    },
    {
      label: "Ordens",
      value: String(ordersOpen),
      description: "em aberto para execução",
      variation: formatDelta(percentDelta(ordersOpenCurrent, ordersOpenPrevious)),
      trend: trendFromDelta(percentDelta(ordersOpenCurrent, ordersOpenPrevious)),
      onOpen: () => navigate("/service-orders"),
    },
    {
      label: "SLA",
      value: `${clampPercent(slaCurrent).toFixed(0)}%`,
      description: "ordens no prazo",
      variation: formatDelta(percentDelta(slaCurrent, slaPrevious)),
      trend: trendFromDelta(percentDelta(slaCurrent, slaPrevious)),
      onOpen: () => navigate("/service-orders"),
    },
    {
      label: "Ticket médio",
      value: formatCurrency(ticketCurrent),
      description: "valor por cobrança paga",
      variation: formatDelta(percentDelta(ticketCurrent, ticketPrevious)),
      trend: trendFromDelta(percentDelta(ticketCurrent, ticketPrevious)),
      onOpen: () => navigate("/finances"),
    },
  ];

  return (
    <AppPageShell>
      <AppPageHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="nexo-page-header-title">Centro de decisão operacional</h1>
            <p className="nexo-page-header-description">Direção executiva para agir rápido no ciclo Cliente → Agendamento → O.S. → Cobrança.</p>
          </div>
          <Button size="sm" onClick={() => void executeNextAction()} disabled={isExecutingNext || nextActions.length === 0}>
            {isExecutingNext ? "Executando..." : "Executar próxima ação"}
          </Button>
        </div>
      </AppPageHeader>

      <AppSectionCard className="border-[var(--brand-primary)]/35 bg-[var(--surface-elevated)] px-4 py-4 md:px-5 md:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">Direção executiva</p>
            <p className="text-base font-semibold text-[var(--text-primary)] md:text-lg">Visão consolidada para manter a operação previsível hoje</p>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{operationalState.summary} · {appointmentsToday} agendamentos hoje e variação de {formatDelta(percentDelta(appointmentsToday, appointmentsYesterday))} vs ontem.</p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => void executeNextAction()} disabled={isExecutingNext || nextActions.length === 0}>
            {isExecutingNext ? "Executando..." : "Executar próxima ação"}
          </Button>
        </div>
      </AppSectionCard>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => {
          const isUp = item.trend === "up";
          const isDown = item.trend === "down";
          return (
            <AppSectionCard key={item.label} className="flex h-full min-h-[132px] flex-col p-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{item.label}</p>
              <p className="mt-1.5 text-[1.65rem] font-semibold leading-none text-[var(--text-primary)]">{item.value}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{item.description}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className={`inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium ${
                  isUp
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : isDown
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    : "bg-muted text-[var(--text-muted)]"
                }`}>
                  {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : null}
                  {item.variation}
                </span>
                <Button variant="ghost" size="sm" className="h-6 shrink-0 px-1.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]" onClick={item.onOpen}>
                  Abrir <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </AppSectionCard>
          );
        })}
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <AppSectionCard className="p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Próxima ação recomendada</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Foco imediato para destravar execução e receita.</p>
          <div className="space-y-2">
            {(nextActions.length > 0
              ? nextActions.slice(0, 3).map((action) => ({
                title: action.title,
                description: action.description,
                actionLabel: "Resolver",
                onAction: () => void executeAction(action.executionAction),
              }))
              : [{ title: "Nenhuma ação crítica agora", description: "A operação está estável no momento.", actionLabel: "Agenda", onAction: () => navigate("/appointments") }]).map((item) => (
              <CompactActionItem key={item.title} {...item} />
            ))}
          </div>
        </AppSectionCard>

        <AppSectionCard className="p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">O que está parado agora</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Itens sem avanço que exigem intervenção curta.</p>
          <div className="space-y-2">
            {(bottlenecks.length > 0
              ? bottlenecks.slice(0, 3).map((item) => ({
                title: item.label,
                description: `Impacto atual: ${item.value}`,
                actionLabel: "Atuar",
                onAction: () => navigate(item.href),
              }))
              : [{ title: "Sem gargalos críticos", description: "Nenhum bloqueio operacional relevante identificado.", actionLabel: "Financeiro", onAction: () => navigate("/finances") }]).map((item) => (
              <CompactActionItem key={item.title} {...item} />
            ))}
          </div>
        </AppSectionCard>

        <AppSectionCard className="p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">O que pode virar dinheiro hoje</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Prioridades comerciais e financeiras de giro rápido.</p>
          <div className="space-y-2">
            {opportunities.slice(0, 3).map((opportunity, index) => (
              <CompactActionItem
                key={opportunity}
                title={opportunity}
                description="Acompanhe este ponto agora para elevar conversão ou recebimento no dia."
                actionLabel={index === 0 ? "Cobrar" : "Abrir"}
                onAction={() => navigate(index === 0 ? "/finances" : "/service-orders")}
              />
            ))}
          </div>
        </AppSectionCard>
      </section>
    </AppPageShell>
  );
}

function pipelinePotential(serviceOrders: any[]) {
  return serviceOrders.filter((item) => String(item?.status ?? "").toUpperCase() === "DONE" && !item?.financialSummary?.hasCharge).length;
}
