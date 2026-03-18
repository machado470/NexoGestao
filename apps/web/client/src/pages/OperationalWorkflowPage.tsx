import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useChargeActions } from "@/hooks/useChargeActions";
import { trpc } from "@/lib/trpc";
import {
  getErrorMessage,
  normalizeAlertsPayload,
  normalizeArrayPayload,
} from "@/lib/query-helpers";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  CreditCard,
} from "lucide-react";

export default function OperationalWorkflowPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;
  const [location, navigate] = useLocation();

  const chargesQuery = trpc.finance.charges.list.useQuery(
    {
      page: 1,
      limit: 50,
      status: "PENDING",
    },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery(
    {
      page: 1,
      limit: 50,
    },
    {
      enabled: canQuery,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const alertsQuery = trpc.dashboard.alerts.useQuery(undefined, {
    enabled: canQuery,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { registerPayment, generateCheckout, isSubmitting } = useChargeActions({
    location,
    navigate,
    returnPath: "/operations",
    refreshActions: [() => chargesQuery.refetch(), () => alertsQuery.refetch()],
  });

  const serviceOrders = useMemo(() => {
    return normalizeArrayPayload(serviceOrdersQuery.data);
  }, [serviceOrdersQuery.data]);

  const charges = useMemo(() => {
    return normalizeArrayPayload(chargesQuery.data);
  }, [chargesQuery.data]);

  const alerts = useMemo(() => {
    return normalizeAlertsPayload(alertsQuery.data);
  }, [alertsQuery.data]);

  const overdueOrders = Array.isArray(alerts?.overdueOrders?.items)
    ? alerts.overdueOrders.items
    : [];

  const overdueCharges = Array.isArray(alerts?.overdueCharges?.items)
    ? alerts.overdueCharges.items
    : [];

  const doneOrdersWithoutCharge = Array.isArray(alerts?.doneOrdersWithoutCharge?.items)
    ? alerts.doneOrdersWithoutCharge.items
    : [];

  const openOrders = useMemo(() => {
    return serviceOrders.filter((item: any) =>
      ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(String(item?.status ?? ""))
    );
  }, [serviceOrders]);

  const isLoading =
    chargesQuery.isLoading || serviceOrdersQuery.isLoading || alertsQuery.isLoading;

  const hasError =
    chargesQuery.isError || serviceOrdersQuery.isError || alertsQuery.isError;

  const errorMessage =
    getErrorMessage(chargesQuery.error, "") ||
    getErrorMessage(serviceOrdersQuery.error, "") ||
    getErrorMessage(alertsQuery.error, "") ||
    "Não foi possível carregar o fluxo operacional agora.";

  if (isInitializing) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          Carregando sessão...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          Faça login para visualizar o fluxo operacional.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          Carregando fluxo operacional...
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fluxo Operacional</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe ordens abertas, cobranças pendentes e alertas reais do fluxo.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            void chargesQuery.refetch();
            void serviceOrdersQuery.refetch();
            void alertsQuery.refetch();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            Ordens abertas
          </div>
          <div className="mt-2 text-2xl font-bold">{openOrders.length}</div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            Cobranças pendentes
          </div>
          <div className="mt-2 text-2xl font-bold">{charges.length}</div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Cobranças vencidas
          </div>
          <div className="mt-2 text-2xl font-bold">{overdueCharges.length}</div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Concluídas sem cobrança
          </div>
          <div className="mt-2 text-2xl font-bold">{doneOrdersWithoutCharge.length}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h2 className="mb-3 font-semibold">Ordens em andamento</h2>

          {openOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma ordem operacional pendente.
            </p>
          ) : (
            <div className="space-y-2">
              {openOrders.map((order: any) => (
                <div key={order.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">
                    {order.title || "Ordem de serviço"}
                  </div>
                  <div className="text-muted-foreground">
                    {order.customer?.name || "Sem cliente"} • {order.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="mb-3 font-semibold">Cobranças pendentes</h2>

          {charges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma cobrança pendente.
            </p>
          ) : (
            <div className="space-y-2">
              {charges.map((charge: any) => (
                <div key={charge.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">
                        {charge.notes?.trim() ||
                          charge.serviceOrder?.title ||
                          "Cobrança"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {charge.customer?.name || "Sem cliente"} •{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format((Number(charge.amountCents ?? 0)) / 100)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void generateCheckout(charge)}
                        disabled={isSubmitting}
                      >
                        <CreditCard className="mr-1 h-4 w-4" />
                        Checkout
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => void registerPayment(charge, "PIX")}
                        disabled={isSubmitting}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Marcar paga
                      </Button>
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
          <h2 className="mb-3 font-semibold">Cobranças vencidas</h2>

          {overdueCharges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma cobrança vencida.
            </p>
          ) : (
            <div className="space-y-2">
              {overdueCharges.slice(0, 5).map((charge: any) => (
                <div key={charge.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">
                    {charge.customer?.name || "Cliente"}
                  </div>
                  <div className="text-muted-foreground">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format((Number(charge.amountCents ?? 0)) / 100)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="mb-3 font-semibold">O.S. concluídas sem cobrança</h2>

          {doneOrdersWithoutCharge.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma O.S. concluída sem cobrança aparente.
            </p>
          ) : (
            <div className="space-y-2">
              {doneOrdersWithoutCharge.slice(0, 5).map((order: any) => (
                <div key={order.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">
                    {order.title || "Ordem de serviço"}
                  </div>
                  <div className="text-muted-foreground">
                    {order.customer?.name || "Sem cliente"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
