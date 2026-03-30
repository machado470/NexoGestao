import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useChargeActions } from "@/hooks/useChargeActions";
import { useLocation } from "wouter";

import {
  buildWhatsAppUrlFromCharge,
  buildServiceOrdersDeepLink,
  buildOperationalContextFromCharge,
  buildOperationalContextFromServiceOrder,
  buildWhatsAppUrlFromContext,
  normalizeCharges,
  normalizeOrders,
  normalizeStatus,
  formatCurrency,
} from "@/lib/operations/operations.utils";

import { normalizeAlertsPayload } from "@/lib/query-helpers";

import {
  getServiceOrderNextAction,
  matchesFinancialFilter,
} from "@/lib/operations/operations.selectors";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageCircle,
  RefreshCw,
  Receipt,
  Wrench,
} from "lucide-react";

export default function OperationsDashboardPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;
  const [location, navigate] = useLocation();

  const utils = trpc.useUtils();

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

  const startExecution = trpc.nexo.executions.start.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success("Execução iniciada");
      await Promise.all([
        utils.nexo.serviceOrders.list.invalidate(),
        utils.dashboard.alerts.invalidate(),
      ]);

      if (variables?.serviceOrderId) {
        navigate(buildServiceOrdersDeepLink(variables.serviceOrderId));
      }
    },
  });

  const finishExecution = trpc.nexo.executions.complete.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success("Execução concluída");
      await Promise.all([
        utils.nexo.serviceOrders.list.invalidate(),
        utils.finance.charges.list.invalidate(),
        utils.dashboard.alerts.invalidate(),
      ]);

      if (variables?.id) {
        navigate(buildServiceOrdersDeepLink(variables.id));
      }
    },
  });

  const { registerPayment, generateCheckout, isSubmitting } =
    useChargeActions({
      location,
      navigate,
      returnPath: "/dashboard/operations",
      refreshActions: [
        () => serviceOrdersQuery.refetch(),
        () => chargesQuery.refetch(),
        () => alertsQuery.refetch(),
      ],
    });

  const serviceOrders = useMemo(
    () => normalizeOrders(serviceOrdersQuery.data),
    [serviceOrdersQuery.data]
  );

  const charges = useMemo(
    () => normalizeCharges(chargesQuery.data),
    [chargesQuery.data]
  );

  const alerts = useMemo(
    () => normalizeAlertsPayload<any>(alertsQuery.data),
    [alertsQuery.data]
  );

  const urgentOrders = useMemo(() => {
    return serviceOrders
      .filter((order: any) => getServiceOrderNextAction(order).tone === "red")
      .slice(0, 5);
  }, [serviceOrders]);

  const readyToChargeOrders = useMemo(() => {
    return serviceOrders
      .filter((order: any) => matchesFinancialFilter(order, "READY_TO_CHARGE"))
      .slice(0, 5);
  }, [serviceOrders]);

  const pendingCharges = useMemo(() => {
    return charges.slice(0, 5);
  }, [charges]);

  async function refreshAll() {
    await Promise.all([
      serviceOrdersQuery.refetch(),
      chargesQuery.refetch(),
      alertsQuery.refetch(),
    ]);
  }

  if (isInitializing) return <div className="p-6">Carregando...</div>;
  if (!isAuthenticated) return <div className="p-6">Faça login.</div>;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Centro de Operações</h1>

      {/* ALERTAS CRÍTICOS */}
      {alerts?.overdueCharges?.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cobranças vencidas</CardTitle>
          </CardHeader>

          <CardContent className="flex justify-between items-center">
            <div>
              <p>{alerts.overdueCharges.count} cobranças</p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(alerts.overdueCharges.totalAmountCents)}
              </p>
            </div>

            <Button
              onClick={() => {
                const first = alerts?.overdueCharges?.items?.[0];
                const ctx = buildOperationalContextFromCharge(first);
                const url = buildWhatsAppUrlFromContext(ctx);

                if (!url) {
                  toast.error("Sem cliente vinculado");
                  return;
                }

                navigate(url);
              }}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Cobrar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ORDENS URGENTES */}
      <Card>
        <CardHeader>
          <CardTitle>Ordens urgentes</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {urgentOrders.map((order: any) => {
            const next = getServiceOrderNextAction(order);

            return (
              <div key={order.id} className="border p-3 rounded space-y-2">
                <p className="font-medium">{order.title}</p>
                <p className="text-sm text-muted-foreground">
                  {next.title}
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(buildServiceOrdersDeepLink(order.id))
                    }
                  >
                    Abrir
                  </Button>

                  {normalizeStatus(order.status) === "OPEN" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        startExecution.mutate({ serviceOrderId: order.id })
                      }
                    >
                      Iniciar
                    </Button>
                  )}

                  {normalizeStatus(order.status) === "IN_PROGRESS" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        finishExecution.mutate({ id: order.id })
                      }
                    >
                      Finalizar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* PRONTAS PRA COBRAR */}
      <Card>
        <CardHeader>
          <CardTitle>Prontas para cobrar</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {readyToChargeOrders.map((order: any) => {
            const ctx = buildOperationalContextFromServiceOrder(order);
            const whatsappUrl = buildWhatsAppUrlFromContext(ctx);

            return (
              <div key={order.id} className="border p-3 rounded space-y-2">
                <p className="font-medium">{order.title}</p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate(buildServiceOrdersDeepLink(order.id))
                    }
                  >
                    Abrir
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => whatsappUrl && navigate(whatsappUrl)}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* COBRANÇAS */}
      <Card>
        <CardHeader>
          <CardTitle>Cobranças pendentes</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {pendingCharges.map((charge: any) => {
            const whatsappUrl = buildWhatsAppUrlFromCharge(charge);

            return (
              <div key={charge.id} className="border p-3 rounded space-y-2">
                <p>{charge.customer?.name}</p>
                <p>{formatCurrency(charge.amountCents)}</p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => generateCheckout(charge)}
                  >
                    Checkout
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => registerPayment(charge, "CASH")}
                  >
                    Marcar pago
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => whatsappUrl && navigate(whatsappUrl)}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Contexto
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
