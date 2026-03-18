import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  CreditCard,
} from "lucide-react";

function formatCurrency(cents?: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((Number(cents ?? 0)) / 100);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return message;
  }

  return fallback;
}

export default function OperationalWorkflowPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;
  const utils = trpc.useUtils();
  const [location, navigate] = useLocation();

  const searchParams = useMemo(() => {
    const queryString = location.includes("?") ? location.split("?")[1] : "";
    return new URLSearchParams(queryString);
  }, [location]);

  const checkoutStatusFromUrl = searchParams.get("checkout")?.trim() || "";
  const checkoutChargeIdFromUrl = searchParams.get("chargeId")?.trim() || "";

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

  useEffect(() => {
    if (!checkoutStatusFromUrl) return;

    if (checkoutStatusFromUrl === "success") {
      toast.success(
        checkoutChargeIdFromUrl
          ? `Checkout concluído para cobrança ${checkoutChargeIdFromUrl.slice(0, 8)}.`
          : "Checkout concluído com sucesso."
      );
    } else if (checkoutStatusFromUrl === "cancel") {
      toast.error(
        checkoutChargeIdFromUrl
          ? `Checkout cancelado para cobrança ${checkoutChargeIdFromUrl.slice(0, 8)}.`
          : "Checkout cancelado."
      );
    }

    navigate("/operations", { replace: true });
  }, [checkoutStatusFromUrl, checkoutChargeIdFromUrl, navigate]);

  const payCharge = trpc.finance.charges.pay.useMutation({
    onSuccess: async () => {
      toast.success("Pagamento registrado com sucesso");
      await Promise.all([
        chargesQuery.refetch(),
        alertsQuery.refetch(),
        utils.finance.charges.list.invalidate(),
        utils.finance.charges.stats.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao registrar pagamento");
    },
  });

  const checkoutCharge = trpc.payments.checkout.useMutation({
    onError: (error) => {
      toast.error(error.message || "Erro ao gerar checkout");
    },
  });

  const serviceOrders = useMemo(() => {
    const payload: any = serviceOrdersQuery.data;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    return [];
  }, [serviceOrdersQuery.data]);

  const charges = useMemo(() => {
    const payload: any = chargesQuery.data;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  }, [chargesQuery.data]);

  const alerts = useMemo(() => {
    const payload: any = alertsQuery.data;
    return payload?.data ?? payload ?? null;
  }, [alertsQuery.data]);

  const overdueOrders = Array.isArray(alerts?.overdueOrders?.items)
    ? alerts.overdueOrders.items
    : [];

  const overdueCharges = Array.isArray(alerts?.overdueCharges?.items)
    ? alerts.overdueCharges.items
    : [];

  const openOrders = useMemo(() => {
    return serviceOrders.filter((item: any) =>
      ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(String(item?.status ?? ""))
    );
  }, [serviceOrders]);

  const isSubmitting = payCharge.isPending || checkoutCharge.isPending;

  const isLoading =
    chargesQuery.isLoading || serviceOrdersQuery.isLoading || alertsQuery.isLoading;

  const hasError =
    chargesQuery.isError || serviceOrdersQuery.isError || alertsQuery.isError;

  const errorMessage =
    getErrorMessage(chargesQuery.error, "") ||
    getErrorMessage(serviceOrdersQuery.error, "") ||
    getErrorMessage(alertsQuery.error, "") ||
    "Não foi possível carregar o fluxo operacional agora.";

  const markChargePaid = async (id: string, amountCents?: number) => {
    const safeAmountCents = Number(amountCents ?? 0);

    if (!safeAmountCents || safeAmountCents <= 0) {
      toast.error("Valor da cobrança inválido para registrar pagamento");
      return;
    }

    await payCharge.mutateAsync({
      chargeId: id,
      method: "PIX",
      amountCents: safeAmountCents,
    });
  };

  const generateCheckout = async (charge: any) => {
    const amountCents = Number(charge?.amountCents ?? 0);

    if (!amountCents || amountCents <= 0) {
      toast.error("Valor da cobrança inválido para checkout");
      return;
    }

    if (!charge?.customerId) {
      toast.error("Cobrança sem cliente vinculado");
      return;
    }

    const description =
      charge?.notes?.trim() ||
      charge?.serviceOrder?.title ||
      `Cobrança #${String(charge.id).slice(0, 8)}`;

    const origin = window.location.origin;

    const result = await checkoutCharge.mutateAsync({
      chargeId: String(charge.id),
      customerId: String(charge.customerId),
      amount: amountCents,
      description,
      successUrl: `${origin}/operations?checkout=success&chargeId=${String(charge.id)}`,
      cancelUrl: `${origin}/operations?checkout=cancel&chargeId=${String(charge.id)}`,
    });

    const checkoutUrl = result?.checkoutUrl;

    if (!checkoutUrl) {
      toast.error("Checkout retornado sem URL");
      return;
    }

    window.location.href = checkoutUrl;
  };

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
            Acompanhe ordens abertas, cobranças pendentes e alertas.
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

      <div className="grid gap-4 md:grid-cols-3">
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
            Alertas críticos
          </div>
          <div className="mt-2 text-2xl font-bold">
            {overdueOrders.length + overdueCharges.length}
          </div>
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
                        {charge.notes || "Cobrança"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {charge.customer?.name || "Sem cliente"} •{" "}
                        {formatCurrency(charge.amountCents)}
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
                        onClick={() =>
                          void markChargePaid(
                            String(charge.id),
                            Number(charge.amountCents ?? 0)
                          )
                        }
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
    </div>
  );
}
