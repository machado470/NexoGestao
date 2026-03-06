import React, { useState } from "react";
import { trpc } from "@/lib/trpc";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type DashboardNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string | Date;
};

function AlertCard({ title, count, colorClass, children }: {
  title: string;
  count: number;
  colorClass: string;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-2xl border p-4 dark:border-zinc-800 ${count > 0 ? colorClass : ""}`}>
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => count > 0 && setExpanded(!expanded)}
      >
        <span className="font-medium">{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-sm font-semibold ${count > 0 ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>
          {count}
        </span>
      </div>
      {expanded && count > 0 && (
        <div className="mt-3 space-y-2 border-t pt-3 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const alertsQuery = trpc.nexo.dashboard.alerts.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const metricsQuery = trpc.nexo.dashboard.metrics.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const notificationsQuery = trpc.dashboard.notifications.useQuery({ limit: 8 }, {
    refetchInterval: 30_000,
  });

  const alerts = (alertsQuery.data as any)?.data ?? alertsQuery.data;
  const metrics = (metricsQuery.data as any)?.data ?? metricsQuery.data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {(alertsQuery.isLoading || metricsQuery.isLoading) && (
          <span className="text-sm text-zinc-500">Carregando...</span>
        )}
      </div>

      {/* Métricas principais */}
      {metrics && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border p-4 dark:border-zinc-800">
            <div className="text-sm text-zinc-500">Clientes ativos</div>
            <div className="mt-1 text-2xl font-bold">{metrics.totalCustomers ?? 0}</div>
          </div>
          <div className="rounded-2xl border p-4 dark:border-zinc-800">
            <div className="text-sm text-zinc-500">O.S. abertas</div>
            <div className="mt-1 text-2xl font-bold">{metrics.openServiceOrders ?? 0}</div>
          </div>
          <div className="rounded-2xl border p-4 dark:border-zinc-800">
            <div className="text-sm text-zinc-500">Receita semanal</div>
            <div className="mt-1 text-2xl font-bold">
              {formatCurrency(metrics.weeklyRevenueInCents ?? 0)}
            </div>
          </div>
          <div className="rounded-2xl border p-4 dark:border-zinc-800">
            <div className="text-sm text-zinc-500">Pendente</div>
            <div className="mt-1 text-2xl font-bold text-yellow-600">
              {formatCurrency(metrics.pendingPaymentsInCents ?? 0)}
            </div>
          </div>
        </div>
      )}


      <div>
        <h2 className="mb-3 text-lg font-semibold">Notificações Operacionais</h2>
        {notificationsQuery.isLoading ? (
          <div className="rounded-2xl border p-4 text-sm text-zinc-500 dark:border-zinc-800">Carregando notificações...</div>
        ) : notificationsQuery.data && notificationsQuery.data.length > 0 ? (
          <div className="space-y-2">
            {notificationsQuery.data.map((notification: DashboardNotification) => (
              <div key={notification.id} className="rounded-2xl border p-3 dark:border-zinc-800">
                <div className="text-sm font-semibold">{notification.title}</div>
                <div className="text-sm text-zinc-600 dark:text-zinc-300">{notification.message}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {new Date(notification.createdAt).toLocaleString("pt-BR")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border p-4 text-sm text-zinc-500 dark:border-zinc-800">
            Sem notificações operacionais no momento.
          </div>
        )}
      </div>

      {/* Alertas operacionais */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Alertas Operacionais</h2>
        {alertsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : alertsQuery.isError ? (
          <div className="rounded-2xl border border-red-200 p-4 text-red-600 dark:border-red-900">
            Erro ao carregar alertas.
          </div>
        ) : alerts ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <AlertCard
              title="Ordens Atrasadas"
              count={alerts.overdueOrders?.count ?? 0}
              colorClass="border-red-200 dark:border-red-900"
            >
              {alerts.overdueOrders?.items?.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{order.title}</div>
                    <div className="text-xs text-zinc-500">{order.customer?.name}</div>
                  </div>
                  <div className="text-xs text-red-500">
                    {order.scheduledFor ? formatDate(order.scheduledFor) : "—"}
                  </div>
                </div>
              ))}
            </AlertCard>

            <AlertCard
              title="Cobranças Vencidas"
              count={alerts.overdueCharges?.count ?? 0}
              colorClass="border-orange-200 dark:border-orange-900"
            >
              <div className="mb-2 text-sm font-medium text-orange-600">
                Total: {formatCurrency(alerts.overdueCharges?.totalAmountCents ?? 0)}
              </div>
              {alerts.overdueCharges?.items?.map((charge: any) => (
                <div key={charge.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{charge.customer?.name}</div>
                    <div className="text-xs text-zinc-500">Venceu em {formatDate(charge.dueDate)}</div>
                  </div>
                  <div className="font-semibold text-orange-600">
                    {formatCurrency(charge.amountCents)}
                  </div>
                </div>
              ))}
            </AlertCard>

            <AlertCard
              title="Serviços de Hoje"
              count={alerts.todayServices?.count ?? 0}
              colorClass="border-blue-200 dark:border-blue-900"
            >
              {alerts.todayServices?.items?.map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{apt.title || "Agendamento"}</div>
                    <div className="text-xs text-zinc-500">{apt.customer?.name}</div>
                  </div>
                  <div className="text-xs text-blue-500">
                    {new Date(apt.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </AlertCard>

            <AlertCard
              title="Clientes com Pendência"
              count={alerts.customersWithPending?.count ?? 0}
              colorClass="border-yellow-200 dark:border-yellow-900"
            >
              {alerts.customersWithPending?.items?.map((customer: any) => (
                <div key={customer.id} className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-xs text-zinc-500">{customer.pendingCharges} cobrança(s)</div>
                  </div>
                  <div className="font-semibold text-yellow-600">
                    {formatCurrency(customer.totalPendingCents)}
                  </div>
                </div>
              ))}
            </AlertCard>
          </div>
        ) : null}
      </div>
    </div>
  );
}
