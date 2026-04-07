import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
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
};

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
}: MetricCardProps) {
  return (
    <div className="nexo-kpi-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
          <div className="mt-3 nexo-metric-value">{value}</div>
          {description ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
          ) : null}
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-200/80 bg-orange-100/80 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
          <Icon className="h-5 w-5" />
        </div>
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

  const metrics = normalizeMetrics(metricsQuery.data);
  const revenue = normalizeSeriesArray(revenueQuery.data);
  const serviceOrdersStatus = normalizeStatusCollection(serviceOrdersStatusQuery.data);
  const chargesStatus = normalizeStatusCollection(chargesStatusQuery.data);

  const lineChartData = useMemo(
    () =>
      revenue.map((item: any, index: number) => ({
        period: item?.month ?? item?.date ?? `P${index + 1}`,
        value: Number(item?.revenue ?? item?.amount ?? 0),
      })),
    [revenue]
  );

  const paidCharges = chargesStatus.find((item) => item.key.toLowerCase() === "paid")?.value ?? 0;
  const funnelData = [
    { value: Math.max(metrics.totalCustomers, 0), name: "Clientes" },
    { value: Math.max(metrics.totalServiceOrders + metrics.openServiceOrders, 0), name: "Agendamentos" },
    { value: Math.max(metrics.totalServiceOrders, 0), name: "O.S." },
    { value: Math.max(paidCharges, 0), name: "Pagamentos" },
  ];

  const bottlenecks = [
    {
      id: "no-billing",
      label: "O.S. sem cobrança",
      value: Math.max(metrics.openServiceOrders, 0),
      action: "Cobrar agora",
      onClick: () => navigate("/finances"),
    },
    {
      id: "overdue",
      label: "Cobranças vencidas",
      value:
        chargesStatus.find((item) => item.key.toLowerCase() === "overdue")?.value ?? 0,
      action: "Ver vencidas",
      onClick: () => navigate("/finances"),
    },
    {
      id: "unconfirmed",
      label: "Agendamentos sem confirmação",
      value: Math.max(metrics.inProgressOrders, 0),
      action: "Confirmar agenda",
      onClick: () => navigate("/appointments"),
    },
  ];

  const hasAnyCriticalError =
    metricsQuery.isError &&
    revenueQuery.isError &&
    serviceOrdersStatusQuery.isError &&
    chargesStatusQuery.isError;

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
      <section className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-sm dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(19,22,30,0.98),rgba(12,14,20,0.96))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
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
              className="inline-flex h-10 items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              Atacar gargalos
            </button>
            <button
              type="button"
              onClick={() => navigate("/finances")}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Abrir financeiro
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Clientes ativos" value={metricsQuery.isLoading ? "..." : metrics.totalCustomers} description="Base ativa acompanhada pela operação." />
        <MetricCard icon={Briefcase} label="Ordens de serviço" value={metricsQuery.isLoading ? "..." : metrics.totalServiceOrders} description={`${metrics.openServiceOrders} abertas • ${metrics.inProgressOrders} em andamento`} />
        <MetricCard icon={DollarSign} label="Receita total" value={metricsQuery.isLoading ? "..." : formatCurrency(metrics.totalRevenueInCents)} description={`Recebido: ${formatCurrency(metrics.paidRevenueInCents)}`} />
        <MetricCard icon={AlertTriangle} label="Risco / atrasos" value={metricsQuery.isLoading ? "..." : Number(metrics.riskTickets) + Number(metrics.delayedOrders)} description={`Tickets: ${metrics.riskTickets} • atrasadas: ${metrics.delayedOrders}`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="nexo-surface p-5 xl:col-span-2">
          <h2 className="nexo-section-title">Receita ao longo do tempo</h2>
          <p className="mt-1 nexo-section-description">Linha temporal de evolução de receita.</p>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value) * 100)} />
                <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="nexo-surface p-5">
          <h2 className="nexo-section-title">Funil operacional</h2>
          <p className="mt-1 nexo-section-description">Cliente → Agendamento → O.S. → Pagamento.</p>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="value" data={funnelData} isAnimationActive>
                  <LabelList position="right" fill="#52525b" stroke="none" dataKey="name" />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="nexo-surface p-5">
          <h2 className="nexo-section-title">Distribuição de status</h2>
          <p className="mt-1 nexo-section-description">Volume atual por status de cobrança.</p>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chargesStatus} dataKey="value" nameKey="label" innerRadius={52} outerRadius={86}>
                  {chargesStatus.map((entry, index) => (
                    <Cell key={entry.key} fill={["#f97316", "#22c55e", "#ef4444", "#3b82f6"][index % 4]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="nexo-surface p-5">
          <h2 className="nexo-section-title">Gargalos agora</h2>
          <p className="mt-1 nexo-section-description">Pendências com ação direta para destravar receita.</p>
          <div className="mt-4 space-y-3">
            {bottlenecks.map((item) => (
              <div key={item.id} className="nexo-list-row">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">{item.label}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.value} itens</p>
                </div>
                <button
                  type="button"
                  onClick={item.onClick}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {item.action}
                </button>
              </div>
            ))}
          </div>
          {(metricsQuery.isLoading || revenueQuery.isLoading) && (
            <div className="mt-3 inline-flex items-center gap-2 text-xs text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Atualizando blocos...
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
