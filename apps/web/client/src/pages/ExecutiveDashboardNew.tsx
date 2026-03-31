import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  DollarSign,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";

function formatCurrency(cents?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents ?? 0)) / 100);
}

function formatRevenueValue(value?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function normalizeKeyLabel(key: string) {
  const labels: Record<string, string> = {
    open: "Abertas",
    assigned: "Atribuídas",
    inProgress: "Em andamento",
    completed: "Concluídas",
    cancelled: "Canceladas",
    pending: "Pendentes",
    paid: "Pagas",
    overdue: "Vencidas",
  };

  return labels[key] ?? key;
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
};

function DataListCard({
  title,
  description,
  icon: Icon,
  items,
  emptyText,
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

      {items.length === 0 ? (
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

export default function ExecutiveDashboardNew() {
  const metricsQuery = trpc.dashboard.kpis.useQuery();
  const revenueQuery = trpc.dashboard.revenueTrend.useQuery();
  const growthQuery = trpc.dashboard.customerGrowth.useQuery();
  const serviceOrdersStatusQuery = trpc.dashboard.serviceOrdersStatus.useQuery();
  const chargesStatusQuery = trpc.dashboard.chargeDistribution.useQuery();

  const metrics = (metricsQuery.data as any) ?? {};

  const revenue = Array.isArray(revenueQuery.data) ? revenueQuery.data : [];
  const growth = Array.isArray(growthQuery.data) ? growthQuery.data : [];

  const rawServiceOrdersStatus =
    serviceOrdersStatusQuery.data &&
    typeof serviceOrdersStatusQuery.data === "object"
      ? (serviceOrdersStatusQuery.data as Record<string, number>)
      : {};

  const rawChargesStatus =
    chargesStatusQuery.data && typeof chargesStatusQuery.data === "object"
      ? (chargesStatusQuery.data as Record<string, number>)
      : {};

  const serviceOrdersStatus = Object.entries(rawServiceOrdersStatus).map(
    ([key, value]) => ({
      key,
      label: normalizeKeyLabel(key),
      value: Number(value ?? 0),
    })
  );

  const chargesStatus = Object.entries(rawChargesStatus).map(([key, value]) => ({
    key,
    label: normalizeKeyLabel(key),
    value: Number(value ?? 0),
  }));

  const isLoading =
    metricsQuery.isLoading ||
    revenueQuery.isLoading ||
    growthQuery.isLoading ||
    serviceOrdersStatusQuery.isLoading ||
    chargesStatusQuery.isLoading;

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
              mais limpo, mais forte e com leitura mais premium.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="nexo-subtle-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
                Receita semanal
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                {formatCurrency(metrics?.weeklyRevenueInCents)}
              </p>
            </div>

            <div className="nexo-subtle-surface px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
                Pendências
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                {formatCurrency(metrics?.pendingPaymentsInCents)}
              </p>
            </div>

            <div className="nexo-subtle-surface col-span-2 px-4 py-3 sm:col-span-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-500">
                Ordens concluídas
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-950 dark:text-white">
                {metrics?.completedOrders ?? 0}
              </p>
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="nexo-surface flex items-center justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Clientes ativos"
          value={metrics?.totalCustomers ?? 0}
          description="Base ativa acompanhada pela operação."
        />

        <MetricCard
          icon={Briefcase}
          label="Ordens de serviço"
          value={metrics?.totalServiceOrders ?? 0}
          description={`${metrics?.openServiceOrders ?? 0} abertas • ${
            metrics?.inProgressOrders ?? 0
          } em andamento`}
        />

        <MetricCard
          icon={DollarSign}
          label="Receita total"
          value={formatCurrency(metrics?.totalRevenueInCents)}
          description={`Recebido: ${formatCurrency(metrics?.paidRevenueInCents)}`}
        />

        <MetricCard
          icon={AlertTriangle}
          label="Risco / atrasos"
          value={
            Number(metrics?.riskTickets ?? 0) +
            Number(metrics?.delayedOrders ?? 0)
          }
          description={`Tickets: ${metrics?.riskTickets ?? 0} • atrasadas: ${
            metrics?.delayedOrders ?? 0
          }`}
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
        />

        <DataListCard
          title="Status das cobranças"
          description="Panorama atual do financeiro conectado à operação."
          items={chargesStatus.map((item) => ({
            label: item.label,
            value: item.value,
          }))}
          emptyText="Sem dados de cobranças."
        />
      </section>
    </div>
  );
}
