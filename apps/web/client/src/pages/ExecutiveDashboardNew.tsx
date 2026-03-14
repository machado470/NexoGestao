import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  TrendingUp,
  Users,
  Briefcase,
  DollarSign,
  AlertTriangle,
  Loader2,
} from "lucide-react";

function formatCurrency(cents?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents ?? 0)) / 100);
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

export default function ExecutiveDashboardNew() {
  const metricsQuery = trpc.dashboard.kpis.useQuery();
  const revenueQuery = trpc.dashboard.revenueTrend.useQuery();
  const growthQuery = trpc.dashboard.customerGrowth.useQuery();
  const serviceOrdersStatusQuery = trpc.dashboard.serviceOrdersStatus.useQuery();
  const chargesStatusQuery = trpc.dashboard.chargeDistribution.useQuery();

  const metrics = (metricsQuery.data as any) ?? {};

  const revenue = Array.isArray(revenueQuery.data)
    ? revenueQuery.data
    : [];

  const growth = Array.isArray(growthQuery.data)
    ? growthQuery.data
    : [];

  const rawServiceOrdersStatus =
    serviceOrdersStatusQuery.data && typeof serviceOrdersStatusQuery.data === "object"
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
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6 text-orange-500" />
          Dashboard Executivo
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão consolidada de métricas, crescimento e operação.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border p-10">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            Clientes ativos
          </div>
          <div className="mt-2 text-2xl font-bold">
            {metrics?.totalCustomers ?? 0}
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Briefcase className="h-4 w-4" />
            Ordens de serviço
          </div>
          <div className="mt-2 text-2xl font-bold">
            {metrics?.totalServiceOrders ?? 0}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {metrics?.openServiceOrders ?? 0} abertas •{" "}
            {metrics?.inProgressOrders ?? 0} em andamento
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            Receita total
          </div>
          <div className="mt-2 text-2xl font-bold">
            {formatCurrency(metrics?.totalRevenueInCents)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Recebido: {formatCurrency(metrics?.paidRevenueInCents)}
          </p>
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Risco / atrasos
          </div>
          <div className="mt-2 text-2xl font-bold">
            {Number(metrics?.riskTickets ?? 0) + Number(metrics?.delayedOrders ?? 0)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Tickets: {metrics?.riskTickets ?? 0} • atrasadas: {metrics?.delayedOrders ?? 0}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            Receita por período
          </h2>

          {revenue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dados de receita.
            </p>
          ) : (
            <div className="space-y-2">
              {revenue.map((item: any, index: number) => (
                <div
                  key={`${item?.month ?? "periodo"}-${index}`}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>{item?.month ?? `Período ${index + 1}`}</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(Number(item?.revenue ?? 0))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="mb-3 font-semibold">Crescimento de clientes</h2>

          {growth.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dados de crescimento.
            </p>
          ) : (
            <div className="space-y-2">
              {growth.map((item: any, index: number) => (
                <div
                  key={`${item?.month ?? "mes"}-${index}`}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>{item?.month ?? `Período ${index + 1}`}</span>
                  <div className="text-right">
                    <div className="font-medium">
                      +{item?.newCustomers ?? 0} novos
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total acumulado: {item?.totalCustomers ?? 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 font-semibold">Status das ordens de serviço</h2>

          {serviceOrdersStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dados de ordens de serviço.
            </p>
          ) : (
            <div className="space-y-2">
              {serviceOrdersStatus.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="mb-3 font-semibold">Status das cobranças</h2>

          {chargesStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem dados de cobranças.
            </p>
          ) : (
            <div className="space-y-2">
              {chargesStatus.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded border p-2 text-sm"
                >
                  <span>{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-4">
          <div className="text-sm text-muted-foreground">Receita semanal</div>
          <div className="mt-2 text-xl font-bold">
            {formatCurrency(metrics?.weeklyRevenueInCents)}
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm text-muted-foreground">Pagamentos pendentes</div>
          <div className="mt-2 text-xl font-bold">
            {formatCurrency(metrics?.pendingPaymentsInCents)}
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="text-sm text-muted-foreground">Ordens concluídas</div>
          <div className="mt-2 text-xl font-bold">
            {metrics?.completedOrders ?? 0}
          </div>
        </div>
      </div>
    </div>
  );
}
