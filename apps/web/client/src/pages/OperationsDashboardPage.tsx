import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useChargeActions } from "@/hooks/useChargeActions";
import { useLocation } from "wouter";
import {
  normalizeAppointments,
  normalizeCharges,
  normalizeOrders,
  normalizeStatus,
} from "@/lib/operations/operations.utils";
import { normalizeAlertsPayload } from "@/lib/query-helpers";

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents ?? 0) / 100);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

export default function OperationsDashboardPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;
  const [location, navigate] = useLocation();

  const utils = trpc.useUtils();

  const appointmentsQuery = trpc.nexo.appointments.list.useQuery(
    {},
    { enabled: canQuery, retry: false }
  );

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 50 },
    { enabled: canQuery, retry: false }
  );

  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 50, status: "PENDING" },
    { enabled: canQuery, retry: false }
  );

  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
  });

  // ✅ NOVO: usar execution real
  const startExecution = trpc.nexo.executions.start.useMutation({
    onSuccess: async (_result, variables) => {
      toast.success("Execução iniciada");

      await Promise.all([
        utils.nexo.serviceOrders.list.invalidate(),
        utils.nexo.timeline.listByServiceOrder.invalidate({
          serviceOrderId: variables.serviceOrderId,
        }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const finishExecution = trpc.nexo.executions.complete.useMutation({
    onSuccess: async (_result, variables) => {
      toast.success("Execução concluída");

      await Promise.all([
        utils.nexo.serviceOrders.list.invalidate(),
        utils.nexo.timeline.listByServiceOrder.invalidate({
          serviceOrderId: variables.id,
        }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });

  const { registerPayment, generateCheckout, isSubmitting } =
    useChargeActions({
      location,
      navigate,
      returnPath: "/dashboard/operations",
      refreshActions: [
        () => chargesQuery.refetch(),
        () => alertsQuery.refetch(),
      ],
    });

  const appointments = useMemo(() => {
    return normalizeAppointments(appointmentsQuery.data);
  }, [appointmentsQuery.data]);

  const serviceOrders = useMemo(() => {
    return normalizeOrders(serviceOrdersQuery.data);
  }, [serviceOrdersQuery.data]);

  const charges = useMemo(() => {
    return normalizeCharges(chargesQuery.data);
  }, [chargesQuery.data]);

  const alerts = useMemo(() => {
    return normalizeAlertsPayload<any>(alertsQuery.data);
  }, [alertsQuery.data]);

  const today = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, []);

  const serviceOrdersToday = useMemo(() => {
    return serviceOrders.filter((item: any) => {
      const ref =
        item?.scheduledFor ||
        item?.dueDate ||
        item?.appointment?.startsAt ||
        item?.createdAt;

      if (!ref) return false;

      const date = new Date(ref);
      return date >= today.start && date <= today.end;
    });
  }, [serviceOrders, today]);

  if (isInitializing) return <div className="p-6">Carregando...</div>;
  if (!isAuthenticated) return <div className="p-6">Faça login.</div>;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Operações</h1>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Ordens de serviço</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {serviceOrdersToday.map((order: any) => {
              const status = normalizeStatus(order.status);

              return (
                <div key={order.id} className="rounded-lg border p-3">
                  <div className="mb-3">
                    <div className="font-medium">{order.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {order.customer?.name}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={
                        !["OPEN", "ASSIGNED"].includes(status) ||
                        startExecution.isPending
                      }
                      onClick={() =>
                        startExecution.mutate({
                          serviceOrderId: order.id,
                        })
                      }
                    >
                      Iniciar
                    </Button>

                    <Button
                      size="sm"
                      disabled={
                        status !== "IN_PROGRESS" ||
                        finishExecution.isPending
                      }
                      onClick={() =>
                        finishExecution.mutate({
                          id: order.id,
                        })
                      }
                    >
                      Concluir
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Cobranças</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {charges.map((charge: any) => (
              <div key={charge.id} className="rounded-lg border p-3">
                <div className="font-medium">
                  {charge.customer?.name}
                </div>

                <div className="text-sm text-muted-foreground">
                  {formatCurrency(charge.amountCents)}
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={() => generateCheckout(charge)}
                    disabled={isSubmitting}
                  >
                    Checkout
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => registerPayment(charge, "CASH")}
                    disabled={isSubmitting}
                  >
                    Pagar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
