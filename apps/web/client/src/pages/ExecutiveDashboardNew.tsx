import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  DollarSign,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents ?? 0) / 100);
}

function formatRevenueValue(value?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
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
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <div className="mt-3 nexo-metric-value">{value}</div>
          {description ? (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {description}
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

type DataListCardProps = {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: Array<{
    label: string;
    value: string | number;
    helper?: string;
  }>;
  emptyText: string;
  isLoading?: boolean;
  errorText?: string | null;
};

function DataListCard({
  title,
  description,
  icon: Icon,
  items,
  emptyText,
  isLoading = false,
  errorText = null,
}: DataListCardProps) {
  return (
    <section className="nexo-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="nexo-section-title">{title}</h2>
          {description ? (
            <p className="mt-1 nexo-section-description">{description}</p>
          ) : null}
        </div>

        {Icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-orange-400">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200/80 px-4 py-8 text-sm text-zinc-500 dark:border-white/8 dark:text-zinc-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-orange-500" />
          Carregando...
        </div>
      ) : errorText ? (
        <div className="rounded-2xl border border-red-200 px-4 py-6 text-sm text-red-600 dark:border-red-900/40 dark:text-red-300">
          {errorText}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-6 text-sm text-zinc-500 dark:border-white/8 dark:text-zinc-400">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={`${item.label}-${item.value}`} className="nexo-list-row">
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                  {item.label}
                </p>
                {item.helper ? (
                  <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {item.helper}
                  </p>
                ) : null}
              </div>

              <div className="ml-4 shrink-0 text-right font-semibold text-zinc-950 dark:text-white">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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
  const raw =
    (payload as any)?.data?.data ??
    (payload as any)?.data ??
    payload ??
    {};

  return {
    totalCustomers: Number((raw as any)?.totalCustomers ?? 0),
    totalServiceOrders: Number((raw as any)?.totalServiceOrders ?? 0),
    openServiceOrders: Number(
      (raw as any)?.openServiceOrders ?? (raw as any)?.openOrders ?? 0
    ),
    inProgressOrders: Number(
      (raw as any)?.inProgressOrders ??
        (raw as any)?.inProgressServiceOrders ??
        0
    ),
    totalRevenueInCents: Number((raw as any)?.totalRevenueInCents ?? 0),
    paidRevenueInCents: Number((raw as any)?.paidRevenueInCents ?? 0),
    pendingPaymentsInCents: Number(
      (raw as any)?.pendingPaymentsInCents ??
        (raw as any)?.pendingRevenueInCents ??
        0
    ),
    weeklyRevenueInCents: Number((raw as any)?.weeklyRevenueInCents ?? 0),
    completedOrders: Number(
      (raw as any)?.completedOrders ?? (raw as any)?.doneServiceOrders ?? 0
    ),
    riskTickets: Number((raw as any)?.riskTickets ?? 0),
    delayedOrders: Number((raw as any)?.delayedOrders ?? 0),
  };
}

function normalizeSeriesArray(payload: unknown) {
  const raw =
    (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

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
  const raw =
    (payload as any)?.data?.data ?? (payload as any)?.data ?? payload;

  if (Array.isArray(raw)) {
    return raw
      .map((item: any, index: number) => {
        const key =
          String(
            item?.key ??
              item?.status ??
              item?.name ??
              item?.label ??
              `item_${index}`
          ).trim() || `item_${index}`;

        const value = Number(
          item?.value ?? item?.count ?? item?.total ?? item?.amount ?? 0
        );

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

  const revenueQuery = trpc.dashboard.revenueTrend.useQuery(
    undefined,
    queryOptions
  );

  const growthQuery = trpc.dashboard.customerGrowth.useQuery(
    undefined,
    queryOptions
  );

  const serviceOrdersStatusQuery = trpc.dashboard.serviceOrdersStatus.useQuery(
    undefined,
    queryOptions
  );

  const chargesStatusQuery = trpc.dashboard.chargeDistribution.useQuery(
    undefined,
    queryOptions
  );

  const metrics = normalizeMetrics(metricsQuery.data);
  const revenue = normalizeSeriesArray(revenueQuery.data);
  const growth = normalizeSeriesArray(growthQuery.data);
  const serviceOrdersStatus = normalizeStatusCollection(
    serviceOrdersStatusQuery.data
  );
  const chargesStatus = normalizeStatusCollection(chargesStatusQuery.data);

  const allResolved =
    !metricsQuery.isLoading &&
    !revenueQuery.isLoading &&
    !growthQuery.isLoading &&
    !serviceOrdersStatusQuery.isLoading &&
    !chargesStatusQuery.isLoading;

  const hasAnyCriticalError =
    allResolved &&
    metricsQuery.isError &&
    revenueQuery.isError &&
    growthQuery.isError &&
    serviceOrdersStatusQuery.isError &&
    chargesStatusQuery.isError;

  if (isInitializing) {
    return (
      <div className="space-y-8 p-6">
        <section className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-sm dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(19,22,30,0.98),rgba(12,14,20,0.96))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
            Dashboard Executivo
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Preparando sessão e carregando contexto.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <DataListCard
            title="Receita por período"
            items={[]}
            emptyText="Carregando..."
            isLoading
          />
          <DataListCard
            title="Crescimento de clientes"
            items={[]}
            emptyText="Carregando..."
            isLoading
          />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 p-6">
        <section className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-sm dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(19,22,30,0.98),rgba(12,14,20,0.96))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
            Dashboard Executivo
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Sua sessão não está ativa.
          </p>
        </section>
      </div>
    );
  }

  if (hasAnyCriticalError) {
    return (
      <div className="space-y-6 p-6">
        <section className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-sm dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(19,22,30,0.98),rgba(12,14,20,0.96))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white md:text-4xl">
            Dashboard Executivo
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            O painel não conseguiu carregar os blocos principais agora.
          </p>
        </section>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {getErrorMessage(metricsQuery.error)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      <section className="relative overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-white/90 px-6 py-6 shadow-sm dark:border-white/8 dark:bg-[linear-gradient(135deg,rgba(19,22,30,0.98),rgba(12,14,20,0.96))] dark:shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(96,165,250,0.08),transparent_24%)]" />

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
              Visão consolidada de métricas, crescimento e operação em um painel
              mais limpo, mais forte e sem morrer por causa de um bloco só.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="nexo-subtle-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
                Receita semanal
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                {metricsQuery.isLoading
                  ? "..."
                  : formatCurrency(metrics.weeklyRevenueInCents)}
              </p>
            </div>

            <div className="nexo-subtle-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
                Pendências
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                {metricsQuery.isLoading
                  ? "..."
                  : formatCurrency(metrics.pendingPaymentsInCents)}
              </p>
            </div>

            <div className="nexo-subtle-surface col-span-2 px-4 py-3 sm:col-span-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
                Ordens concluídas
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                {metricsQuery.isLoading ? "..." : metrics.completedOrders}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Clientes ativos"
          value={metricsQuery.isLoading ? "..." : metrics.totalCustomers}
          description="Base ativa acompanhada pela operação."
        />

        <MetricCard
          icon={Briefcase}
          label="Ordens de serviço"
          value={metricsQuery.isLoading ? "..." : metrics.totalServiceOrders}
          description={`${metrics.openServiceOrders} abertas • ${metrics.inProgressOrders} em andamento`}
        />

        <MetricCard
          icon={DollarSign}
          label="Receita total"
          value={
            metricsQuery.isLoading
              ? "..."
              : formatCurrency(metrics.totalRevenueInCents)
          }
          description={`Recebido: ${formatCurrency(metrics.paidRevenueInCents)}`}
        />

        <MetricCard
          icon={AlertTriangle}
          label="Risco / atrasos"
          value={
            metricsQuery.isLoading
              ? "..."
              : Number(metrics.riskTickets) + Number(metrics.delayedOrders)
          }
          description={`Tickets: ${metrics.riskTickets} • atrasadas: ${metrics.delayedOrders}`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <DataListCard
          title="Receita por período"
          description="Leitura rápida de entrada ao longo do tempo."
          icon={TrendingUp}
          items={revenue.map((item: any, index: number) => ({
            label: item?.month ?? `Período ${index + 1}`,
            value: formatRevenueValue(item?.revenue),
          }))}
          emptyText="Sem dados de receita."
          isLoading={revenueQuery.isLoading}
          errorText={revenueQuery.isError ? getErrorMessage(revenueQuery.error) : null}
        />

        <DataListCard
          title="Crescimento de clientes"
          description="Entrada de novos clientes e base acumulada."
          icon={Users}
          items={growth.map((item: any, index: number) => ({
            label: item?.month ?? `Período ${index + 1}`,
            value: `+${item?.newCustomers ?? 0}`,
            helper: `Total acumulado: ${item?.totalCustomers ?? 0}`,
          }))}
          emptyText="Sem dados de crescimento."
          isLoading={growthQuery.isLoading}
          errorText={growthQuery.isError ? getErrorMessage(growthQuery.error) : null}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <DataListCard
          title="Status das ordens de serviço"
          description="Distribuição atual da execução operacional."
          items={serviceOrdersStatus.map((item) => ({
            label: item.label,
            value: item.value,
          }))}
          emptyText="Sem dados de ordens de serviço."
          isLoading={serviceOrdersStatusQuery.isLoading}
          errorText={
            serviceOrdersStatusQuery.isError
              ? getErrorMessage(serviceOrdersStatusQuery.error)
              : null
          }
        />

        <DataListCard
          title="Status das cobranças"
          description="Panorama atual do financeiro conectado à operação."
          items={chargesStatus.map((item) => ({
            label: item.label,
            value: item.value,
          }))}
          emptyText="Sem dados de cobranças."
          isLoading={chargesStatusQuery.isLoading}
          errorText={
            chargesStatusQuery.isError
              ? getErrorMessage(chargesStatusQuery.error)
              : null
          }
        />
      </section>
    </div>
  );
}
