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
  buildServiceOrdersDeepLink,
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
    onError: (error) => {
      toast.error(error.message || "Erro ao iniciar execução");
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
    onError: (error) => {
      toast.error(error.message || "Erro ao concluir execução");
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
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Centro de Operações</h1>
          <p className="text-sm text-muted-foreground">
            Cockpit de triagem. A execução detalhada acontece na O.S.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refreshAll()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>

          <Button onClick={() => navigate("/service-orders")}>
            <Wrench className="mr-2 h-4 w-4" />
            Abrir fila operacional
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Cobranças vencidas
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {alerts?.overdueCharges?.count ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatCurrency(alerts?.overdueCharges?.totalAmountCents ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Serviços atrasados
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {alerts?.overdueOrders?.count ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">
              Demandam ação operacional
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Sem cobrança
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {alerts?.doneOrdersWithoutCharge?.count ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">
              Concluídos e ainda não cobrados
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Clientes com pendência
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {alerts?.customersWithPending?.count ?? 0}
            </div>
            <div className="text-sm text-muted-foreground">
              Pedem contato e acompanhamento
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ações imediatas</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {alerts?.overdueCharges?.count > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-red-500" />
                <div>
                  <div className="font-medium">
                    {alerts.overdueCharges.count} cobranças vencidas
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total em risco:{" "}
                    {formatCurrency(alerts.overdueCharges.totalAmountCents)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
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
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Cobrar no WhatsApp
                </Button>

                <Button onClick={() => navigate("/service-orders")}>
                  Ver fila
                </Button>
              </div>
            </div>
          )}

          {alerts?.overdueOrders?.count > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 text-amber-500" />
                <div>
                  <div className="font-medium">
                    {alerts.overdueOrders.count} serviços atrasados
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Priorize a abertura da O.S. certa.
                  </div>
                </div>
              </div>

              <Button onClick={() => navigate("/service-orders")}>
                Resolver na fila operacional
              </Button>
            </div>
          )}

          {alerts?.doneOrdersWithoutCharge?.count > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <Receipt className="mt-0.5 h-4 w-4 text-blue-500" />
                <div>
                  <div className="font-medium">
                    {alerts.doneOrdersWithoutCharge.count} serviços sem cobrança
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Geração de cobrança pendente após execução concluída.
                  </div>
                </div>
              </div>

              <Button onClick={() => navigate("/service-orders")}>
                Abrir O.S.
              </Button>
            </div>
          )}

          {!alerts?.overdueCharges?.count &&
          !alerts?.overdueOrders?.count &&
          !alerts?.doneOrdersWithoutCharge?.count ? (
            <div className="text-sm text-muted-foreground">
              Nenhuma ação imediata encontrada agora.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Ordens urgentes</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {urgentOrders.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhuma ordem urgente no momento.
              </div>
            ) : (
              urgentOrders.map((order: any) => {
                const nextAction = getServiceOrderNextAction(order);

                return (
                  <div key={order.id} className="rounded-xl border p-3">
                    <div className="font-medium">{order.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {nextAction.title}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(buildServiceOrdersDeepLink(order.id))}
                      >
                        Abrir O.S.
                      </Button>

                      {["OPEN", "ASSIGNED"].includes(
                        normalizeStatus(order.status)
                      ) ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            startExecution.mutate({ serviceOrderId: order.id })
                          }
                          disabled={startExecution.isPending}
                        >
                          Iniciar
                        </Button>
                      ) : normalizeStatus(order.status) === "IN_PROGRESS" ? (
                        <Button
                          size="sm"
                          onClick={() => finishExecution.mutate({ id: order.id })}
                          disabled={finishExecution.isPending}
                        >
                          Finalizar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Prontas para cobrar</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {readyToChargeOrders.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhuma O.S. pronta para cobrança.
              </div>
            ) : (
              readyToChargeOrders.map((order: any) => {
                const whatsappUrl = buildWhatsAppConversationUrl({
                  customerId: order?.customerId ? String(order.customerId) : null,
                  context: "service_order_followup",
                  serviceOrderId: order?.id ? String(order.id) : null,
                });

                return (
                  <div key={order.id} className="rounded-xl border p-3">
                    <div className="font-medium">{order.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Execução concluída, cobrança pendente.
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(buildServiceOrdersDeepLink(order.id))}
                      >
                        Abrir O.S.
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (whatsappUrl) navigate(whatsappUrl);
                        }}
                        disabled={!whatsappUrl}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        WhatsApp
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Cobranças pendentes</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {pendingCharges.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nenhuma cobrança pendente encontrada.
              </div>
            ) : (
              pendingCharges.map((charge: any) => {
                const whatsappUrl = buildWhatsAppUrlFromCharge(charge);

                return (
                  <div key={charge.id} className="rounded-xl border p-3">
                    <div className="font-medium">
                      {charge.customer?.name || "Cliente"}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatCurrency(charge.amountCents)}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void generateCheckout(charge)}
                        disabled={isSubmitting}
                      >
                        Checkout
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void registerPayment(charge, "CASH")}
                        disabled={isSubmitting}
                      >
                        Marcar pago
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (charge.serviceOrderId) {
                            navigate(buildServiceOrdersDeepLink(charge.serviceOrderId));
                            return;
                          }

                          if (whatsappUrl) navigate(whatsappUrl);
                        }}
                      >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Abrir contexto
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo operacional</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total de O.S.
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {serviceOrders.length}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Total de cobranças pendentes
            </div>
            <div className="mt-1 text-2xl font-semibold">{charges.length}</div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Execução concluída
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {
                serviceOrders.filter(
                  (order: any) => normalizeStatus(order.status) === "DONE"
                ).length
              }
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Parte pronta do ciclo operacional
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
