import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import {
  AppEntityContextPanel,
  AppNextActionList,
  AppPageHeader,
  AppPageShell,
  AppSectionCard,
  AppTimeline,
  AppTimelineItem,
  AppOperationalStateCard,
  AppOperationalStatePanel,
} from "@/components/app-system";
import { AppKpiRow, AppListBlock } from "@/components/internal-page-system";
import { Button } from "@/components/ui/button";
import { useActionHandler } from "@/hooks/useActionHandler";
import { AppLoadingState, AppNextActions } from "@/components/app";
import {
  buildBottleneckGroups,
  buildEntityContextBridge,
  buildNextActions,
  getOperationalStateSummary,
} from "@/lib/operations/operational-hub";
import { formatDelta, getDayWindow, getWindow, inRange, percentDelta, safeDate, trendFromDelta } from "@/lib/operational/kpi";
import { setBootPhase } from "@/lib/bootPhase";

function toArray<T>(payload: unknown): T[] {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;
  return Array.isArray(raw) ? (raw as T[]) : [];
}

function toMetrics(payload: unknown) {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload ?? {};
  return {
    openServiceOrders: Number((raw as any)?.openServiceOrders ?? (raw as any)?.openOrders ?? 0),
    pendingPaymentsInCents: Number((raw as any)?.pendingPaymentsInCents ?? 0),
    totalRevenueInCents: Number((raw as any)?.totalRevenueInCents ?? 0),
    delayedOrders: Number((raw as any)?.delayedOrders ?? 0),
  };
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function ExecutiveDashboardNew() {
  setBootPhase("PAGE:ExecutiveDashboard");
  const { isAuthenticated, isInitializing } = useAuth();
  const [, navigate] = useLocation();
  const { executeAction } = useActionHandler();
  const [isExecutingNext, setIsExecutingNext] = useState(false);
  const canQuery = isAuthenticated && !isInitializing;

  const metricsQuery = trpc.dashboard.kpis.useQuery(undefined, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const governanceSummaryQuery = trpc.governance.summary.useQuery(undefined, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(undefined, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({ page: 1, limit: 100 }, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const chargesQuery = trpc.finance.charges.list.useQuery({ page: 1, limit: 100 }, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });
  const customersQuery = trpc.nexo.customers.list.useQuery(undefined, { enabled: canQuery, retry: false, refetchOnWindowFocus: false });

  const metrics = useMemo(() => toMetrics(metricsQuery.data), [metricsQuery.data]);
  const appointments = useMemo(() => toArray<any>(appointmentsQuery.data), [appointmentsQuery.data]);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // eslint-disable-next-line no-console
    console.log("KPI payload", {
      metrics: metricsQuery.data,
      governance: governanceSummaryQuery.data,
      appointments: appointmentsQuery.data,
      serviceOrders: serviceOrdersQuery.data,
      charges: chargesQuery.data,
      customers: customersQuery.data,
    });
  }, [
    appointmentsQuery.data,
    chargesQuery.data,
    customersQuery.data,
    governanceSummaryQuery.data,
    metricsQuery.data,
    serviceOrdersQuery.data,
  ]);
  const serviceOrders = useMemo(() => toArray<any>(serviceOrdersQuery.data), [serviceOrdersQuery.data]);
  const charges = useMemo(() => toArray<any>(chargesQuery.data), [chargesQuery.data]);
  const customers = useMemo(() => toArray<any>(customersQuery.data), [customersQuery.data]);

  const overdueCharges = charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE").length;
  const doneWithoutCharge = serviceOrders.filter(item => String(item?.status ?? "").toUpperCase() === "DONE" && !item?.financialSummary?.hasCharge).length;
  const overdueAppointments = appointments.filter(item => String(item?.status ?? "").toUpperCase() === "NO_SHOW").length;
  const currentMonth = getWindow(30, 0);
  const previousMonth = getWindow(30, 1);
  const todayWindow = getDayWindow(0);
  const yesterdayWindow = getDayWindow(1);
  const sentCurrent = messagesInRange(charges, currentMonth.start, currentMonth.end);
  const sentPrevious = messagesInRange(charges, previousMonth.start, previousMonth.end);

  function messagesInRange(items: any[], start: Date, end: Date) {
    return items
      .filter((item) => String(item?.status ?? "").toUpperCase() === "PAID")
      .reduce((acc, item) => {
        const date = safeDate(item?.paidAt ?? item?.updatedAt);
        if (!inRange(date, start, end)) return acc;
        return acc + Number(item?.amountCents ?? 0);
      }, 0);
  }

  const appointmentsToday = appointments.filter(item => inRange(safeDate(item?.startsAt), todayWindow.start, todayWindow.end)).length;
  const appointmentsYesterday = appointments.filter(item => inRange(safeDate(item?.startsAt), yesterdayWindow.start, yesterdayWindow.end)).length;
  const ordersExecuting = serviceOrders.filter(item => String(item?.status ?? "").toUpperCase() === "IN_PROGRESS").length;
  const last7 = getWindow(7, 0);
  const prev7 = getWindow(7, 1);
  const ordersExecutingCurrent = serviceOrders.filter(item => String(item?.status ?? "").toUpperCase() === "IN_PROGRESS" && inRange(safeDate(item?.updatedAt), last7.start, last7.end)).length;
  const ordersExecutingPrevious = serviceOrders.filter(item => String(item?.status ?? "").toUpperCase() === "IN_PROGRESS" && inRange(safeDate(item?.updatedAt), prev7.start, prev7.end)).length;
  const overdueCurrent = charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE" && inRange(safeDate(item?.dueDate), currentMonth.start, currentMonth.end)).length;
  const overduePrevious = charges.filter(item => String(item?.status ?? "").toUpperCase() === "OVERDUE" && inRange(safeDate(item?.dueDate), previousMonth.start, previousMonth.end)).length;
  const riskNow = Number((governanceSummaryQuery.data as any)?.data?.riskScore ?? (governanceSummaryQuery.data as any)?.data?.overallRisk ?? 0);
  const riskPrev = Number((governanceSummaryQuery.data as any)?.data?.previousRiskScore ?? NaN);

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
      }).slice(0, 6),
    [appointments, charges, customers, serviceOrders]
  );

  const bottlenecks = useMemo(() => buildBottleneckGroups({ appointments, serviceOrders, charges }), [appointments, charges, serviceOrders]);
  const immediateQueue = nextActions.slice(0, 6).map((action) => ({
    title: action.title,
    subtitle: action.description,
    action: (
      <button className="nexo-cta-secondary" onClick={() => void executeAction(action.executionAction)}>
        Resolver
      </button>
    ),
  }));
  const upcomingQueue = [
    ...appointments
      .filter((item) => ["SCHEDULED", "CONFIRMED"].includes(String(item?.status ?? "").toUpperCase()))
      .slice(0, 2)
      .map((item) => ({
        title: `Agendamento ${String(item?.customer?.name ?? "sem cliente")}`,
        subtitle: `${new Date(String(item?.startsAt)).toLocaleString("pt-BR")} · ${String(item?.status ?? "").toUpperCase()}`,
        action: <button className="nexo-cta-secondary" onClick={() => navigate("/appointments")}>Abrir agenda</button>,
      })),
    ...serviceOrders
      .filter((item) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(String(item?.status ?? "").toUpperCase()))
      .slice(0, 2)
      .map((item) => ({
        title: `O.S. ${String(item?.title ?? item?.id ?? "sem título")}`,
        subtitle: `Status ${String(item?.status ?? "").toUpperCase()} · prioridade P${String(item?.priority ?? 2)}`,
        action: <button className="nexo-cta-secondary" onClick={() => navigate("/service-orders")}>Executar</button>,
      })),
    ...charges
      .filter((item) => ["OVERDUE", "PENDING"].includes(String(item?.status ?? "").toUpperCase()))
      .slice(0, 2)
      .map((item) => ({
        title: `Cobrança ${String(item?.customer?.name ?? "sem cliente")}`,
        subtitle: `Vence em ${item?.dueDate ? new Date(String(item?.dueDate)).toLocaleDateString("pt-BR") : "data não informada"}`,
        action: <button className="nexo-cta-secondary" onClick={() => navigate("/finances")}>Cobrar</button>,
      })),
  ].slice(0, 6);
  const customersActive = customers.filter((item) => Boolean(item?.lastContactAt)).length;
  const customersAtRisk = customers.filter((item) => {
    const lastContact = safeDate(item?.lastContactAt);
    if (!lastContact) return true;
    return Date.now() - lastContact.getTime() > 1000 * 60 * 60 * 24 * 21;
  }).length;
  const customersNoContact = customers.filter((item) => !item?.lastContactAt).length;
  const opportunities = [
    `${pipelinePotential(serviceOrders)} prontos para gerar cobrança hoje`,
    `${overdueCharges} cobranças vencidas com chance de recuperação imediata`,
    `${appointments.filter(item => String(item?.status ?? "").toUpperCase() === "CONFIRMED").length} agendamentos confirmados que podem virar O.S.`,
  ];

  const feed = [
    `${doneWithoutCharge} O.S. concluídas sem cobrança`,
    `${overdueCharges} cobranças vencidas aguardando follow-up`,
    `${metrics.delayedOrders} ordens com atraso operacional`,
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
      metricsQuery.refetch(),
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

  if (metricsQuery.isLoading || governanceSummaryQuery.isLoading) {
    return (
      <AppPageShell>
        <AppLoadingState rows={6} />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell>
      <AppPageHeader>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="nexo-page-header-title">Centro de decisão operacional</h1>
            <p className="nexo-page-header-description">Entenda em segundos o que precisa ser feito agora no ciclo Cliente → Agendamento → O.S. → Cobrança → Pagamento.</p>
          </div>
          <Button onClick={() => void executeNextAction()} disabled={isExecutingNext || nextActions.length === 0}>
            {isExecutingNext ? "Resolvendo próxima pendência..." : "Resolver próxima pendência agora"}
          </Button>
        </div>
      </AppPageHeader>

      <AppNextActions
        title="Engine prioritária de execução"
        engineInput={{
          customers: customers.map(item => ({ id: item.id, name: item.name, phone: item.phone ?? null, lastContactAt: item.lastContactAt ?? null })),
          appointments: appointments.map(item => ({
            id: item.id,
            customerId: item.customerId,
            status: item.status,
            startsAt: item.startsAt,
          })),
          serviceOrders: serviceOrders.map(item => ({
            id: item.id,
            customerId: item.customerId,
            status: item.status,
            delayedMinutes: item.delayedMinutes ?? 0,
            updatedAt: item.updatedAt,
          })),
          charges: charges.map(item => ({
            id: item.id,
            customerId: item.customerId,
            status: item.status,
            amountCents: item.amountCents,
            dueDate: item.dueDate,
          })),
        }}
      />

      <AppOperationalStatePanel>
        <AppOperationalStateCard
          state={operationalState.level}
          summary={operationalState.summary}
          impact={operationalState.impact}
          recommendation={operationalState.recommendedAction}
          className="lg:col-span-2"
        />
        <AppSectionCard>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Ações contextuais</p>
          <p className="text-xs text-[var(--text-muted)]">Atalhos para agir sem sair do foco operacional.</p>
          <div className="mt-3 grid gap-2">
            <button className="nexo-cta-secondary" onClick={() => navigate("/service-orders")}>Concluir serviço em atraso</button>
            <button className="nexo-cta-secondary" onClick={() => navigate("/finances")}>Cobrar cliente com pagamento pendente</button>
            <button className="nexo-cta-secondary" onClick={() => navigate("/appointments")}>Confirmar agendamento de hoje</button>
          </div>
        </AppSectionCard>
      </AppOperationalStatePanel>

      <AppKpiRow
        emphasis="strong"
        items={[
          {
            title: "Recebido no período",
            value: formatCurrency(sentCurrent),
            delta: formatDelta(percentDelta(sentCurrent, sentPrevious)),
            trend: trendFromDelta(percentDelta(sentCurrent, sentPrevious)),
            hint: "últimos 30 dias vs período anterior",
            tone: "important",
          },
          {
            title: "Cobranças em atraso",
            value: String(overdueCharges),
            delta: formatDelta(percentDelta(overdueCurrent, overduePrevious)),
            trend: trendFromDelta(percentDelta(overdueCurrent, overduePrevious)),
            hint: "status OVERDUE no financeiro",
            tone: overdueCharges > 0 ? "critical" : "default",
          },
          {
            title: "Ordens em execução",
            value: String(ordersExecuting),
            delta: formatDelta(percentDelta(ordersExecutingCurrent, ordersExecutingPrevious)),
            trend: trendFromDelta(percentDelta(ordersExecutingCurrent, ordersExecutingPrevious)),
            hint: "IN_PROGRESS · janela de 7 dias",
          },
          {
            title: "Agendamentos do dia",
            value: String(appointmentsToday),
            delta: formatDelta(percentDelta(appointmentsToday, appointmentsYesterday)),
            trend: trendFromDelta(percentDelta(appointmentsToday, appointmentsYesterday)),
            hint: "hoje vs ontem",
          },
          {
            title: "WhatsApp (falhas)",
            value: "N/D",
            hint: "métrica depende de tracking consolidado no endpoint",
          },
          {
            title: "Risco operacional",
            value: `${riskNow}/100`,
            delta: formatDelta(percentDelta(riskNow, riskPrev)),
            trend: trendFromDelta(percentDelta(riskNow, riskPrev)),
            hint: "última leitura de governança",
          },
        ]}
      />

      <section className="grid gap-3 lg:grid-cols-2">
        <AppSectionCard>
          <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">O que resolver agora</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Itens com problema real para executar sem abrir outra tela.</p>
          {immediateQueue.length > 0 ? (
            <AppListBlock items={immediateQueue} />
          ) : (
            <AppNextActionList
              actions={nextActions.map(action => ({
                id: action.id,
                title: action.title,
                description: action.description,
                severity: action.severity,
                action: action.executionAction,
              }))}
            />
          )}
        </AppSectionCard>

        <AppSectionCard>
          <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Próximas ações</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Fila operacional por prioridade: O.S, agenda e cobrança.</p>
          <AppListBlock items={upcomingQueue} />
        </AppSectionCard>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <AppSectionCard>
          <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Operação recente</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Resumo curto do que acabou de acontecer na operação.</p>
          <AppTimeline>
            {feed.map(item => (
              <AppTimelineItem key={item}>{item}</AppTimelineItem>
            ))}
          </AppTimeline>
        </AppSectionCard>
        <AppEntityContextPanel links={buildEntityContextBridge({})} />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <AppSectionCard>
          <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Gargalos</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Atrasados, sem responsável ou sem resposta.</p>
          <AppListBlock items={bottlenecks.slice(0, 5).map((item) => ({
            title: item.label,
            subtitle: `Impacto atual: ${item.value}`,
            action: <button className="nexo-cta-secondary" onClick={() => navigate(item.href)}>Atuar</button>,
          }))} />
        </AppSectionCard>
        <AppSectionCard>
          <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Oportunidade de hoje</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Pode virar dinheiro ou fechamento de cliente ainda hoje.</p>
          <AppTimeline>
            {opportunities.map((item) => (
              <AppTimelineItem key={item}>{item}</AppTimelineItem>
            ))}
          </AppTimeline>
        </AppSectionCard>
        <AppSectionCard>
          <p className="mb-1 text-sm font-semibold text-[var(--text-primary)]">Entidades</p>
          <p className="mb-3 text-xs text-[var(--text-muted)]">Clientes ativos, em risco e sem contato.</p>
          <AppListBlock
            items={[
              { title: `${customersActive} clientes ativos`, subtitle: "contato recente registrado", action: <button className="nexo-cta-secondary" onClick={() => navigate("/customers?tab=active")}>Abrir</button> },
              { title: `${customersAtRisk} clientes em risco`, subtitle: "sem contato há mais de 21 dias", action: <button className="nexo-cta-secondary" onClick={() => navigate("/customers?tab=risk")}>Priorizar</button> },
              { title: `${customersNoContact} clientes sem contato`, subtitle: "não possuem interação registrada", action: <button className="nexo-cta-secondary" onClick={() => navigate("/customers?tab=no-contact")}>Contato</button> },
            ]}
          />
        </AppSectionCard>
      </section>
    </AppPageShell>
  );
}

function pipelinePotential(serviceOrders: any[]) {
  return serviceOrders.filter((item) => String(item?.status ?? "").toUpperCase() === "DONE" && !item?.financialSummary?.hasCharge).length;
}
