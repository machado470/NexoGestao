import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/EmptyState";
import { getLatestActionFlowSuggestion } from "@/lib/actionFlow";
import { rankPriorityProblems } from "@/lib/priorityEngine";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  DollarSign,
  Loader2,
  Users,
} from "lucide-react";
import {
  Cell,
  Funnel,
  FunnelChart,
  Legend,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents ?? 0) / 100);
}

function normalizeKeyLabel(key: string) {
  const normalized = String(key ?? "").trim();

  const labels: Record<string, string> = {
    OPEN: "Abertas",
    ASSIGNED: "Atribuídas",
    IN_PROGRESS: "Em andamento",
    DONE: "Concluídas",
    CANCELED: "Canceladas",
    CANCELLED: "Canceladas",
    PENDING: "Pendentes",
    PAID: "Pagas",
    OVERDUE: "Vencidas",
    open: "Abertas",
    assigned: "Atribuídas",
    inProgress: "Em andamento",
    completed: "Concluídas",
    cancelled: "Canceladas",
    canceled: "Canceladas",
    pending: "Pendentes",
    paid: "Pagas",
    overdue: "Vencidas",
  };

  return labels[normalized] ?? (normalized || "Sem rótulo");
}

type MetricCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  description?: string;
  loading?: boolean;
};

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  loading,
}: MetricCardProps) {
  return (
    <div className="nexo-kpi-card nexo-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
          <div className="mt-3 nexo-metric-value min-h-10">
            {loading ? <div className="nexo-skeleton h-10 w-24 rounded-lg" /> : value}
          </div>
          {description ? (
            <p className="mt-2 min-h-4 text-xs text-zinc-500 dark:text-zinc-400">
              {loading ? <span className="nexo-skeleton inline-block h-4 w-44 rounded" /> : description}
            </p>
          ) : null}
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-200/80 bg-orange-100/80 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function DashboardCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`nexo-skeleton-panel ${className}`}>
      <div className="nexo-skeleton h-5 w-56 rounded" />
      <div className="mt-2 nexo-skeleton h-4 w-72 rounded" />
      <div className="mt-4 space-y-3">
        <div className="nexo-skeleton h-10 w-full rounded-xl" />
        <div className="nexo-skeleton h-10 w-[92%] rounded-xl" />
        <div className="nexo-skeleton h-10 w-[86%] rounded-xl" />
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }

  return "Erro ao carregar bloco.";
}

function normalizeMetrics(payload: unknown) {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload ?? {};

  return {
    totalCustomers: Number((raw as any)?.totalCustomers ?? 0),
    totalServiceOrders: Number((raw as any)?.totalServiceOrders ?? 0),
    openServiceOrders: Number((raw as any)?.openServiceOrders ?? (raw as any)?.openOrders ?? 0),
    inProgressOrders: Number(
      (raw as any)?.inProgressOrders ?? (raw as any)?.inProgressServiceOrders ?? 0
    ),
    totalRevenueInCents: Number((raw as any)?.totalRevenueInCents ?? 0),
    paidRevenueInCents: Number((raw as any)?.paidRevenueInCents ?? 0),
    pendingPaymentsInCents: Number(
      (raw as any)?.pendingPaymentsInCents ?? (raw as any)?.pendingRevenueInCents ?? 0
    ),
    weeklyRevenueInCents: Number((raw as any)?.weeklyRevenueInCents ?? 0),
    completedOrders: Number((raw as any)?.completedOrders ?? (raw as any)?.doneServiceOrders ?? 0),
    riskTickets: Number((raw as any)?.riskTickets ?? 0),
    delayedOrders: Number((raw as any)?.delayedOrders ?? 0),
  };
}

function normalizeSeriesArray(payload: unknown) {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

  if (Array.isArray(raw)) {
    return raw;
  }

  if (Array.isArray((raw as any)?.items)) {
    return (raw as any).items;
  }

  if (Array.isArray((raw as any)?.data)) {
    return (raw as any).data;
  }

  return [];
}

function normalizeStatusCollection(payload: unknown) {
  const raw = (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

  if (Array.isArray(raw)) {
    return raw
      .map((item: any, index: number) => {
        const key =
          String(item?.key ?? item?.status ?? item?.name ?? item?.label ?? `item_${index}`).trim() ||
          `item_${index}`;

        const value = Number(item?.value ?? item?.count ?? item?.total ?? item?.amount ?? 0);

        return {
          key,
          label: normalizeKeyLabel(key),
          value,
        };
      })
      .filter((item) => item.key);
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([key, value]) => ({
      key,
      label: normalizeKeyLabel(key),
      value: Number(value ?? 0),
    }));
  }

  return [];
}

export default function ExecutiveDashboardNew() {
  const { isAuthenticated, isInitializing } = useAuth();
  const [, navigate] = useLocation();
  const canQuery = isAuthenticated && !isInitializing;

  const queryOptions = useMemo(
    () => ({
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }),
    [canQuery]
  );

  const metricsQuery = trpc.dashboard.kpis.useQuery(undefined, queryOptions);
  const revenueQuery = trpc.dashboard.revenueTrend.useQuery(undefined, queryOptions);
  const serviceOrdersStatusQuery = trpc.dashboard.serviceOrdersStatus.useQuery(undefined, queryOptions);
  const chargesStatusQuery = trpc.dashboard.chargeDistribution.useQuery(undefined, queryOptions);
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [optimisticTick, setOptimisticTick] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [stableMetrics, setStableMetrics] = useState(() => normalizeMetrics(undefined));
  const [stableRevenue, setStableRevenue] = useState<any[]>([]);
  const [stableServiceOrdersStatus, setStableServiceOrdersStatus] = useState<any[]>([]);
  const [stableChargesStatus, setStableChargesStatus] = useState<any[]>([]);

  const metrics = normalizeMetrics(metricsQuery.data);
  const revenue = normalizeSeriesArray(revenueQuery.data);
  const serviceOrdersStatus = normalizeStatusCollection(serviceOrdersStatusQuery.data);
  const chargesStatus = normalizeStatusCollection(chargesStatusQuery.data);

  useEffect(() => {
    if (metricsQuery.data !== undefined) {
      setStableMetrics(metrics);
      setLastUpdatedAt(new Date());
    }
  }, [metrics, metricsQuery.data]);

  useEffect(() => {
    if (revenueQuery.data !== undefined) {
      setStableRevenue(revenue);
      setLastUpdatedAt(new Date());
    }
  }, [revenue, revenueQuery.data]);

  useEffect(() => {
    if (serviceOrdersStatusQuery.data !== undefined) {
      setStableServiceOrdersStatus(serviceOrdersStatus);
      setLastUpdatedAt(new Date());
    }
  }, [serviceOrdersStatus, serviceOrdersStatusQuery.data]);

  useEffect(() => {
    if (chargesStatusQuery.data !== undefined) {
      setStableChargesStatus(chargesStatus);
      setLastUpdatedAt(new Date());
    }
  }, [chargesStatus, chargesStatusQuery.data]);

  const displayMetrics = metricsQuery.data !== undefined ? metrics : stableMetrics;
  const displayRevenue = revenueQuery.data !== undefined ? revenue : stableRevenue;
  const displayServiceOrdersStatus =
    serviceOrdersStatusQuery.data !== undefined ? serviceOrdersStatus : stableServiceOrdersStatus;
  const displayChargesStatus = chargesStatusQuery.data !== undefined ? chargesStatus : stableChargesStatus;

  const lineChartData = useMemo(
    () =>
      displayRevenue.map((item: any, index: number) => ({
        period: item?.month ?? item?.date ?? `P${index + 1}`,
        value: Number(item?.revenue ?? item?.amount ?? 0),
      })),
    [displayRevenue]
  );

  const paidCharges = displayChargesStatus.find((item) => item.key.toLowerCase() === "paid")?.value ?? 0;
  const funnelData = [
    { value: Math.max(displayMetrics.totalCustomers, 0), name: "Clientes" },
    { value: Math.max(displayMetrics.totalServiceOrders + displayMetrics.openServiceOrders, 0), name: "Agendamentos" },
    { value: Math.max(displayMetrics.totalServiceOrders, 0), name: "O.S." },
    { value: Math.max(paidCharges, 0), name: "Pagamentos" },
  ];

  const totalPausedRevenue = Math.max(displayMetrics.pendingPaymentsInCents ?? 0, 0);
  const overdueCharges = displayChargesStatus.find((item) => item.key.toLowerCase() === "overdue")?.value ?? 0;
  const averageOrderValueCents =
    displayMetrics.totalServiceOrders > 0
      ? Math.round(displayMetrics.totalRevenueInCents / Math.max(displayMetrics.totalServiceOrders, 1))
      : 0;
  const nonBilledServices = Math.max(displayMetrics.openServiceOrders, 0);
  const nonBilledServicesImpact = Math.max(nonBilledServices * averageOrderValueCents, 0);
  const overdueImpactCents = Math.max(
    overdueCharges *
      Math.max(
        averageOrderValueCents,
        Math.round((displayMetrics.pendingPaymentsInCents || 0) / Math.max(overdueCharges || 1, 1))
      ),
    0
  );
  const operationalRiskItems = Math.max(
    Number(displayMetrics.riskTickets) + Number(displayMetrics.delayedOrders),
    0
  );
  const operationalRiskImpact = Math.round(
    operationalRiskItems * Math.max(averageOrderValueCents, 0) * 0.4
  );

  const priorityProblems = rankPriorityProblems([
    {
      id: "idle-cash",
      type: "idle_cash",
      title: "Dinheiro parado",
      count: Math.max(overdueCharges + nonBilledServices, 0),
      impactCents: totalPausedRevenue + nonBilledServicesImpact,
      ctaLabel: "Recuperar receita agora",
      ctaPath: "/finances",
      helperText: `${formatCurrency(totalPausedRevenue + nonBilledServicesImpact)} aguardando ação.`,
    },
    {
      id: "overdue",
      type: "overdue_charges",
      title: "Cobranças vencidas",
      count: overdueCharges,
      impactCents: overdueImpactCents,
      ctaLabel: "Cobrar vencidas",
      ctaPath: "/finances",
      helperText: `${formatCurrency(overdueImpactCents)} pendente de recebimento.`,
    },
    {
      id: "stalled-os",
      type: "stalled_service_orders",
      title: "O.S. paradas",
      count: Math.max(displayMetrics.delayedOrders, 0),
      impactCents: Math.max(displayMetrics.delayedOrders, 0) * Math.max(averageOrderValueCents, 0),
      ctaLabel: "Destravar O.S.",
      ctaPath: "/service-orders",
      helperText: "Execução travada impactando faturamento.",
    },
    {
      id: "operational-risk",
      type: "operational_risk",
      title: "Risco operacional",
      count: operationalRiskItems,
      impactCents: operationalRiskImpact,
      ctaLabel: "Corrigir riscos",
      ctaPath: "/service-orders",
      helperText: `${formatCurrency(operationalRiskImpact)} em risco se não agir hoje.`,
    },
  ]);
  const dominantProblem = priorityProblems[0];
  const actionFlowSuggestion = getLatestActionFlowSuggestion();

  const bottlenecks = [
    {
      id: "no-billing",
      label: "Serviços sem faturamento",
      value: Math.max(displayMetrics.openServiceOrders, 0),
      severity: "high",
      action: "Cobrar agora",
      onClick: () => navigate("/finances"),
    },
    {
      id: "overdue",
      label: "Cobranças vencidas",
      value: overdueCharges,
      severity: "critical",
      action: "Ver vencidas",
      onClick: () => navigate("/finances"),
    },
    {
      id: "stalled",
      label: "O.S. travadas",
      value: Math.max(displayMetrics.delayedOrders, 0),
      severity: "critical",
      action: "Destravar O.S.",
      onClick: () => navigate("/service-orders"),
    },
  ].sort((a, b) => b.value - a.value);

  const hasAnyCriticalError =
    metricsQuery.isError &&
    revenueQuery.isError &&
    serviceOrdersStatusQuery.isError &&
    chargesStatusQuery.isError;

  const isStillLoading =
    metricsQuery.isLoading ||
    revenueQuery.isLoading ||
    serviceOrdersStatusQuery.isLoading ||
    chargesStatusQuery.isLoading;

  useEffect(() => {
    const hasBackgroundRefresh =
      metricsQuery.isFetching ||
      revenueQuery.isFetching ||
      serviceOrdersStatusQuery.isFetching ||
      chargesStatusQuery.isFetching;

    if (hasBackgroundRefresh) {
      setOptimisticTick(true);
      const timer = window.setTimeout(() => setOptimisticTick(false), 800);
      return () => window.clearTimeout(timer);
    }

    setOptimisticTick(false);
  }, [
    metricsQuery.isFetching,
    revenueQuery.isFetching,
    serviceOrdersStatusQuery.isFetching,
    chargesStatusQuery.isFetching,
  ]);

  useEffect(() => {
    if (!isStillLoading) {
      setIsSlowLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => setIsSlowLoading(true), 10000);
    return () => window.clearTimeout(timeoutId);
  }, [isStillLoading]);

  if (isInitializing) {
    return (
      <div className="space-y-8 p-6">
        <section className="nexo-surface p-6">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
            Dashboard Executivo
          </h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Preparando sessão e carregando contexto.</p>
        </section>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <div className="p-6 text-sm text-zinc-500">Sua sessão não está ativa.</div>;
  }

  if (hasAnyCriticalError) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {getErrorMessage(metricsQuery.error)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {dominantProblem ? (
        <section className="relative overflow-hidden rounded-[2rem] border-2 border-orange-400/70 bg-gradient-to-br from-orange-100 via-white to-orange-50 px-5 py-6 shadow-[0_20px_70px_rgba(251,146,60,.35)] dark:border-orange-400/35 dark:from-orange-950/45 dark:via-zinc-950 dark:to-zinc-900">
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-orange-300/30 blur-3xl dark:bg-orange-500/25" />
          <div className="relative grid gap-5 lg:grid-cols-[1.2fr_auto] lg:items-end">
            <div>
              <p className="inline-flex items-center rounded-full bg-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white">
                Prioridade nº1 de hoje
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
                Hoje você tem {formatCurrency(totalPausedRevenue + nonBilledServicesImpact)} parado
              </h2>
              <p className="mt-3 text-base font-medium text-zinc-800 dark:text-zinc-100">
                {overdueCharges} cobranças vencidas • {nonBilledServices} serviços sem faturamento.
              </p>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                Próxima decisão já definida: <strong>{dominantProblem.title}</strong>. {dominantProblem.helperText}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(dominantProblem.ctaPath)}
              className="nexo-cta-primary min-h-14 min-w-[220px] !rounded-xl !text-base font-bold shadow-lg shadow-orange-500/35"
            >
              {dominantProblem.ctaLabel}
            </button>
          </div>
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/90 px-4 py-5 shadow-sm transition-all duration-300 sm:px-6 sm:py-6 dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(19,22,30,0.98),rgba(12,14,20,0.96))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-100/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
              <BarChart3 className="h-3.5 w-3.5" />
              Visão executiva
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
              Dashboard Executivo
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Leitura para decisão rápida no funil oficial: Cliente → Agendamento → O.S. → Pagamento.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/service-orders")}
              className="nexo-cta-primary min-h-12 flex-1 sm:flex-none"
            >
              Atacar gargalos
            </button>
            <button
              type="button"
              onClick={() => navigate("/finances")}
              className="nexo-cta-secondary min-h-12 flex-1 sm:flex-none"
            >
              Abrir financeiro
            </button>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-orange-200/60 bg-orange-50/80 px-4 py-3 text-sm text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200">
          <p className="font-semibold">O que precisa de atenção agora</p>
          <p className="mt-1">
            Você tem <strong>{formatCurrency(totalPausedRevenue)}</strong> parado e{" "}
            <strong>{formatCurrency(nonBilledServicesImpact)}</strong> em serviços ainda não faturados.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Clientes ativos" value={displayMetrics.totalCustomers} loading={metricsQuery.isLoading && metricsQuery.data === undefined} description="Base ativa acompanhada pela operação." />
        <MetricCard icon={Briefcase} label="Ordens de serviço" value={displayMetrics.totalServiceOrders} loading={metricsQuery.isLoading && metricsQuery.data === undefined} description={`${displayMetrics.openServiceOrders} abertas • ${displayMetrics.inProgressOrders} em andamento`} />
        <MetricCard icon={DollarSign} label="Receita total" value={formatCurrency(displayMetrics.totalRevenueInCents)} loading={metricsQuery.isLoading && metricsQuery.data === undefined} description={`Recebido: ${formatCurrency(displayMetrics.paidRevenueInCents)}`} />
        <MetricCard icon={AlertTriangle} label="Risco / atrasos" value={Number(displayMetrics.riskTickets) + Number(displayMetrics.delayedOrders)} loading={metricsQuery.isLoading && metricsQuery.data === undefined} description={`Tickets: ${displayMetrics.riskTickets} • atrasadas: ${displayMetrics.delayedOrders}`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="nexo-surface nexo-fade-in p-5 xl:col-span-2">
          <h2 className="nexo-section-title">Receita ao longo do tempo</h2>
          <p className="mt-1 nexo-section-description">Linha temporal de evolução de receita.</p>
          {revenueQuery.isLoading && revenueQuery.data === undefined && displayRevenue.length === 0 ? (
            <DashboardCardSkeleton className="mt-4 min-h-[260px]" />
          ) : lineChartData.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="h-6 w-6" />}
              title="Ainda não há série temporal de receita"
              description="Assim que houver cobranças registradas, você verá a evolução no tempo para decidir com mais precisão."
              action={{ label: "Ir para financeiro", onClick: () => navigate("/finances") }}
            />
          ) : (
            <div className="mt-4 h-[260px] nexo-fade-in">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={84} tickFormatter={(value) => formatCurrency(Number(value) * 100)} />
                  <Tooltip
                    contentStyle={{ borderRadius: 14, border: "1px solid rgba(251,146,60,.25)", background: "rgba(9,9,11,.94)", color: "#fff" }}
                    formatter={(value: number) => [formatCurrency(Number(value) * 100), "Receita"]}
                    labelFormatter={(label) => `Período: ${label}`}
                  />
                  <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "#f97316" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className="nexo-surface nexo-fade-in p-5">
          <h2 className="nexo-section-title">Funil operacional</h2>
          <p className="mt-1 nexo-section-description">Cliente → Agendamento → O.S. → Pagamento.</p>
          {funnelData.every((item) => item.value <= 0) ? (
            <EmptyState
              icon={<Briefcase className="h-6 w-6" />}
              title="Funil operacional sem dados"
              description="Cadastre clientes, agendamentos e ordens para enxergar perdas entre as etapas."
              action={{ label: "Abrir clientes", onClick: () => navigate("/customers") }}
            />
          ) : (
            <div className="mt-4 h-[260px] nexo-fade-in">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip
                    contentStyle={{ borderRadius: 14, border: "1px solid rgba(251,146,60,.3)", background: "rgba(255,255,255,.96)" }}
                    formatter={(value: number) => [value, "Volume"]}
                  />
                  <Funnel dataKey="value" data={funnelData} isAnimationActive>
                    <LabelList position="right" fill="#52525b" stroke="none" dataKey="name" />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="nexo-surface nexo-fade-in p-5">
          <h2 className="nexo-section-title">Distribuição de status</h2>
          <p className="mt-1 nexo-section-description">Volume atual por status de cobrança.</p>
          {chargesStatusQuery.isLoading && chargesStatusQuery.data === undefined && displayChargesStatus.length === 0 ? (
            <DashboardCardSkeleton className="mt-4 min-h-[260px]" />
          ) : (
            <div className="mt-4 h-[260px] nexo-fade-in">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 6, right: 10, bottom: 12, left: 10 }}>
                  <Pie data={displayChargesStatus} dataKey="value" nameKey="label" innerRadius={52} outerRadius={86} paddingAngle={3}>
                    {displayChargesStatus.map((entry, index) => (
                      <Cell key={entry.key} fill={["#f97316", "#22c55e", "#ef4444", "#3b82f6"][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 14, border: "1px solid rgba(251,146,60,.25)", background: "rgba(9,9,11,.94)", color: "#fff" }}
                    formatter={(value: number, name) => [value, String(name)]}
                  />
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 14, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </article>

        <article className={`nexo-surface nexo-fade-in p-5 transition-all duration-300 ${optimisticTick ? "ring-2 ring-orange-300/40 dark:ring-orange-500/30" : ""}`}>
          <h2 className="nexo-section-title">Gargalos agora</h2>
          <p className="mt-1 nexo-section-description">Pendências com ação direta para destravar receita.</p>
          <div className="mt-4 space-y-3">
            {bottlenecks.map((item) => (
              <div key={item.id} className={`nexo-list-row ${item.severity === "critical" ? "nexo-list-row-critical" : "nexo-list-row-high"}`}>
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="mr-1.5 inline-block rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide dark:bg-white/10">
                      {item.severity === "critical" ? "Crítico" : "Alto"}
                    </span>
                    {item.value} itens
                  </p>
                </div>
                <button
                  type="button"
                  onClick={item.onClick}
                  className="nexo-cta-secondary !h-10 !rounded-lg !px-4 !text-xs md:!h-8 md:!px-3"
                >
                  {item.action}
                </button>
              </div>
            ))}
          </div>
          {(metricsQuery.isFetching || revenueQuery.isFetching || serviceOrdersStatusQuery.isFetching || chargesStatusQuery.isFetching) && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Atualizando blocos sem interromper sua leitura...
            </div>
          )}
          {lastUpdatedAt ? (
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
              Última atualização: {lastUpdatedAt.toLocaleTimeString("pt-BR")}
            </p>
          ) : null}
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="nexo-surface nexo-fade-in p-5">
          <h2 className="nexo-section-title">Top 3 prioridades automáticas</h2>
          <p className="mt-1 nexo-section-description">Sem lista genérica: apenas o que gera caixa mais rápido.</p>
          <div className="mt-4 space-y-3">
            {priorityProblems.map((problem, index) => (
              <div key={problem.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900/80">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600 dark:text-orange-300">
                  #{index + 1} prioridade
                </p>
                <div className="mt-1 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{problem.title}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                      {problem.count} itens • {formatCurrency(problem.impactCents)} de impacto
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(problem.ctaPath)}
                    className="nexo-cta-secondary !h-9 !rounded-lg !px-3 !text-xs"
                  >
                    {problem.ctaLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        {actionFlowSuggestion ? (
          <article className="rounded-2xl border border-emerald-300/60 bg-emerald-50/70 p-5 dark:border-emerald-700/50 dark:bg-emerald-950/20">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
              Fluxo automático de ação
            </p>
            <h3 className="mt-2 text-lg font-semibold text-emerald-900 dark:text-emerald-100">
              {actionFlowSuggestion.title}
            </h3>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">{actionFlowSuggestion.description}</p>
            <button
              type="button"
              onClick={() => navigate(actionFlowSuggestion.ctaPath)}
              className="nexo-cta-primary mt-4 !h-11 !rounded-xl !px-5"
            >
              {actionFlowSuggestion.ctaLabel}
            </button>
          </article>
        ) : (
          <article className="rounded-2xl border border-zinc-200/80 bg-white/80 p-5 dark:border-white/10 dark:bg-zinc-900/70">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Fluxo automático de ação</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Assim que você criar Cliente, O.S. ou Cobrança, a próxima ação aparece aqui sem precisar interpretar.
            </p>
          </article>
        )}
      </section>

      {(metricsQuery.isError || revenueQuery.isError || serviceOrdersStatusQuery.isError || chargesStatusQuery.isError) && !hasAnyCriticalError ? (
        <section className="rounded-2xl border border-amber-300/50 bg-amber-50/70 p-4 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-200">
          Parte dos blocos não foi carregada. Os dados visíveis já são válidos; atualize a página para tentar completar o painel.
        </section>
      ) : null}

      {isSlowLoading ? (
        <section className="rounded-2xl border border-blue-300/50 bg-blue-50/70 p-4 text-sm text-blue-800 dark:border-blue-800/60 dark:bg-blue-950/20 dark:text-blue-200">
          A atualização está mais lenta que o normal. Você pode continuar navegando enquanto os blocos terminam de carregar.
        </section>
      ) : null}
    </div>
  );
}
