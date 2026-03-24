import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDate(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function AlertCard({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border p-4">
      <div
        className="flex cursor-pointer justify-between"
        onClick={() => count > 0 && setExpanded(!expanded)}
      >
        <span className="font-medium">{title}</span>
        <span className="font-bold">{count}</span>
      </div>

      {expanded && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated, isInitializing } = useAuth();

  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    enabled: isAuthenticated && !isInitializing,
    retry: false,
  });

  const alerts = (alertsQuery.data as any)?.data ?? alertsQuery.data;

  if (!isAuthenticated) return <div className="p-6">Login</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Central de decisão</h1>

      {alerts && (
        <div className="grid gap-4 md:grid-cols-2">

          {/* ORDENS ATRASADAS */}
          <AlertCard
            title="Ordens atrasadas"
            count={alerts.overdueOrders?.count ?? 0}
          >
            {alerts.overdueOrders?.items?.map((o: any) => (
              <div
                key={o.id}
                className="border p-2 rounded cursor-pointer hover:bg-gray-50"
                onClick={() =>
                  window.location.href = `/service-orders?id=${o.id}`
                }
              >
                <div className="font-medium">{o.title}</div>
                <div className="text-xs text-gray-500">
                  {o.customer?.name}
                </div>
              </div>
            ))}
          </AlertCard>

          {/* COBRANÇAS VENCIDAS */}
          <AlertCard
            title="Cobranças vencidas"
            count={alerts.overdueCharges?.count ?? 0}
          >
            {alerts.overdueCharges?.items?.map((c: any) => (
              <div
                key={c.id}
                className="border p-2 rounded cursor-pointer hover:bg-gray-50"
                onClick={() =>
                  window.location.href = `/service-orders?id=${c.serviceOrderId}`
                }
              >
                <div className="font-medium">
                  {c.customer?.name}
                </div>
                <div className="text-sm text-red-600">
                  {formatCurrency(c.amountCents)}
                </div>
              </div>
            ))}
          </AlertCard>

          {/* SEM COBRANÇA */}
          <AlertCard
            title="Execução sem cobrança"
            count={alerts.doneOrdersWithoutCharge?.count ?? 0}
          >
            {alerts.doneOrdersWithoutCharge?.items?.map((o: any) => (
              <div
                key={o.id}
                className="border p-2 rounded cursor-pointer hover:bg-gray-50"
                onClick={() =>
                  window.location.href = `/service-orders?id=${o.id}`
                }
              >
                <div className="font-medium">{o.title}</div>
              </div>
            ))}
          </AlertCard>

        </div>
      )}
    </div>
  );
}
