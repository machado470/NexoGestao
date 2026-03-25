import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useChargeActions } from "@/hooks/useChargeActions";
import { useLocation } from "wouter";
import {
  buildWhatsAppConversationUrl,
  buildWhatsAppUrlFromCharge,
  buildWhatsAppUrlFromServiceOrder,
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

export default function OperationsDashboardPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;
  const [location, navigate] = useLocation();

  const utils = trpc.useUtils();

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    { page: 1, limit: 50 },
    { enabled: canQuery }
  );

  const chargesQuery = trpc.finance.charges.list.useQuery(
    { page: 1, limit: 50, status: "PENDING" },
    { enabled: canQuery }
  );

  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    enabled: canQuery,
  });

  const startExecution = trpc.nexo.executions.start.useMutation({
    onSuccess: () => {
      toast.success("Execução iniciada");
      utils.nexo.serviceOrders.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao iniciar execução");
    },
  });

  const finishExecution = trpc.nexo.executions.complete.useMutation({
    onSuccess: () => {
      toast.success("Execução concluída");
      utils.nexo.serviceOrders.list.invalidate();
      utils.finance.charges.list.invalidate();
      alertsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao concluir execução");
    },
  });

  const { registerPayment, generateCheckout, isSubmitting } =
    useChargeActions({
      location,
      navigate,
      returnPath: "/dashboard/operations",
      refreshActions: [() => chargesQuery.refetch(), () => alertsQuery.refetch()],
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

  if (isInitializing) return <div className="p-6">Carregando...</div>;
  if (!isAuthenticated) return <div className="p-6">Faça login.</div>;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Centro de Operações</h1>

      <Card>
        <CardHeader>
          <CardTitle>Ação imediata</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {alerts?.overdueCharges?.count > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span>
                {alerts.overdueCharges.count} cobranças vencidas •{" "}
                {formatCurrency(alerts.overdueCharges.totalAmountCents)}
              </span>

              <Button
                size="sm"
                onClick={() => {
                  const items = alerts?.overdueCharges?.items || [];
                  const first = items[0];

                  const whatsappUrl = buildWhatsAppConversationUrl({
                    customerId: first?.customerId ? String(first.customerId) : null,
                    context: "overdue_charge",
                    chargeId: first?.id ? String(first.id) : null,
                    serviceOrderId: first?.serviceOrderId
                      ? String(first.serviceOrderId)
                      : null,
                    amountCents:
                      typeof first?.amountCents === "number"
                        ? first.amountCents
                        : null,
                    dueDate: first?.dueDate ? String(first.dueDate) : null,
                  });

                  if (!whatsappUrl) {
                    toast.error("Cobrança sem cliente vinculado");
                    return;
                  }

                  navigate(whatsappUrl);
                }}
              >
                Cobrar no WhatsApp
              </Button>
            </div>
          )}

          {alerts?.overdueOrders?.count > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span>{alerts.overdueOrders.count} serviços atrasados</span>

              <Button size="sm" onClick={() => navigate("/service-orders")}>
                Resolver
              </Button>
            </div>
          )}

          {alerts?.doneOrdersWithoutCharge?.count > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span>{alerts.doneOrdersWithoutCharge.count} serviços sem cobrança</span>

              <Button size="sm" onClick={() => navigate("/service-orders")}>
                Gerar cobrança
              </Button>
            </div>
          )}

          {alerts?.customersWithPending?.count > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span>{alerts.customersWithPending.count} clientes com pendência</span>

              <Button size="sm" onClick={() => navigate("/customers")}>
                Ver clientes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execução</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {serviceOrders.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhuma ordem de serviço encontrada.
            </div>
          ) : (
            serviceOrders.map((order: any) => {
              const status = normalizeStatus(order.status);
              const hasCharge = Boolean(order?.financialSummary?.hasCharge);
              const canSendChargeMessage =
                Boolean(order?.customerId) && status === "DONE";

              const whatsappUrl = buildWhatsAppUrlFromServiceOrder(order);

              return (
                <div key={order.id} className="rounded border p-3">
                  <div className="font-medium">{order.title}</div>

                  <div className="mt-1 text-sm text-muted-foreground">
                    Status: {status}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={
                        !["OPEN", "ASSIGNED"].includes(status) || startExecution.isPending
                      }
                      onClick={() =>
                        startExecution.mutate({ serviceOrderId: order.id })
                      }
                    >
                      Iniciar
                    </Button>

                    <Button
                      size="sm"
                      disabled={status !== "IN_PROGRESS" || finishExecution.isPending}
                      onClick={() => finishExecution.mutate({ id: order.id })}
                    >
                      Concluir
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canSendChargeMessage || !whatsappUrl}
                      onClick={() => {
                        if (whatsappUrl) {
                          navigate(whatsappUrl);
                        }
                      }}
                    >
                      {hasCharge ? "Cobrar cliente" : "Falar com cliente"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cobranças</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {charges.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nenhuma cobrança pendente encontrada.
            </div>
          ) : (
            charges.map((charge: any) => {
              const whatsappUrl = buildWhatsAppUrlFromCharge(charge);

              return (
                <div key={charge.id} className="rounded border p-3">
                  <div className="font-medium">{charge.customer?.name || "Cliente"}</div>
                  <div>{formatCurrency(charge.amountCents)}</div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => void generateCheckout(charge)}
                      disabled={isSubmitting}
                    >
                      Checkout
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => void registerPayment(charge, "CASH")}
                      disabled={isSubmitting}
                    >
                      Pagar
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!whatsappUrl}
                      onClick={() => {
                        if (whatsappUrl) {
                          navigate(whatsappUrl);
                        }
                      }}
                    >
                      Cobrar no WhatsApp
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
