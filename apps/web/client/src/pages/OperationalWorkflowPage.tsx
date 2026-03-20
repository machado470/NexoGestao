import { useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useChargeActions } from "@/hooks/useChargeActions";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  getErrorMessage,
  normalizeAlertsPayload,
  normalizeArrayPayload,
} from "@/lib/query-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RefreshCw,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  CreditCard,
  PlayCircle,
  ArrowRightLeft,
  Wallet,
  Wrench,
  Receipt,
} from "lucide-react";

const SERVICE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberta",
  ASSIGNED: "Atribuída",
  IN_PROGRESS: "Em execução",
  DONE: "Concluída",
  CANCELED: "Cancelada",
};

function formatCurrency(cents?: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(cents ?? 0) / 100);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getServiceOrderTone(status?: string) {
  switch (status) {
    case "OPEN":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    case "ASSIGNED":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "IN_PROGRESS":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "DONE":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "CANCELED":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function getChargeTone(status?: string) {
  switch (status) {
    case "PENDING":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "OVERDUE":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "PAID":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "CANCELED":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function MetricCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

export default function OperationalWorkflowPage() {
  const { isAuthenticated, isInitializing } = useAuth();
  const canQuery = isAuthenticated && !isInitializing;
  const [location, navigate] = useLocation();

  const chargesQuery = trpc.finance.charges.list.useQuery(
    {
      page: 1,
      limit: 100,
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
      limit: 100,
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
    refreshActions: [
      () => chargesQuery.refetch(),
      () => alertsQuery.refetch(),
      () => serviceOrdersQuery.refetch(),
    ],
  });

  const updateServiceOrder = trpc.nexo.serviceOrders.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        chargesQuery.refetch(),
        alertsQuery.refetch(),
        serviceOrdersQuery.refetch(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar ordem de serviço");
    },
  });

  const serviceOrders = useMemo(() => {
    return normalizeArrayPayload<any>(serviceOrdersQuery.data);
  }, [serviceOrdersQuery.data]);

  const charges = useMemo(() => {
    return normalizeArrayPayload<any>(chargesQuery.data);
  }, [chargesQuery.data]);

  const alerts = useMemo(() => {
    return normalizeAlertsPayload<any>(alertsQuery.data);
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

  const actionableOrders = useMemo(() => {
    return serviceOrders.filter((item: any) =>
      ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(String(item?.status ?? ""))
    );
  }, [serviceOrders]);

  const openOrders = useMemo(() => {
    return actionableOrders.filter((item: any) => item?.status === "OPEN");
  }, [actionableOrders]);

  const assignedOrders = useMemo(() => {
    return actionableOrders.filter((item: any) => item?.status === "ASSIGNED");
  }, [actionableOrders]);

  const inProgressOrders = useMemo(() => {
    return actionableOrders.filter((item: any) => item?.status === "IN_PROGRESS");
  }, [actionableOrders]);

  const pendingCharges = useMemo(() => {
    return charges.filter((item: any) => item?.status === "PENDING");
  }, [charges]);

  const overdueChargeRows = useMemo(() => {
    return charges.filter((item: any) => item?.status === "OVERDUE");
  }, [charges]);

  const receivableTotalCents = useMemo(() => {
    return [...pendingCharges, ...overdueChargeRows].reduce((acc: number, item: any) => {
      return acc + Number(item?.amountCents || 0);
    }, 0);
  }, [pendingCharges, overdueChargeRows]);

  const handleStartExecution = (id: string) => {
    updateServiceOrder.mutate(
      { id, data: { status: "IN_PROGRESS" } },
      {
        onSuccess: () => {
          toast.success("Execução iniciada.");
        },
      }
    );
  };

  const handleFinishExecution = (id: string) => {
    updateServiceOrder.mutate(
      { id, data: { status: "DONE" } },
      {
        onSuccess: () => {
          toast.success("Execução concluída.");
        },
      }
    );
  };

  const isLoading =
    chargesQuery.isLoading || serviceOrdersQuery.isLoading || alertsQuery.isLoading;

  const hasError =
    chargesQuery.isError || serviceOrdersQuery.isError || alertsQuery.isError;

  const errorMessage =
    getErrorMessage(chargesQuery.error, "") ||
    getErrorMessage(serviceOrdersQuery.error, "") ||
    getErrorMessage(alertsQuery.error, "") ||
    "Não foi possível carregar o workflow operacional agora.";

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
          Faça login para visualizar o workflow operacional.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-xl border p-4 text-sm text-muted-foreground">
          Carregando workflow operacional...
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wrench className="h-6 w-6 text-orange-500" />
            Workflow Operacional
          </h1>
          <p className="text-sm text-muted-foreground">
            Fila prática do que precisa andar agora entre execução, cobrança e recebimento.
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
        <MetricCard
          title="Executar agora"
          value={openOrders.length + assignedOrders.length + inProgressOrders.length}
          subtitle={`${assignedOrders.length} atribuídas e ${inProgressOrders.length} em execução`}
        />
        <MetricCard
          title="Cobrar agora"
          value={doneOrdersWithoutCharge.length}
          subtitle="O.S. concluídas ainda sem cobrança"
        />
        <MetricCard
          title="Receber agora"
          value={pendingCharges.length + overdueChargeRows.length}
          subtitle={`${overdueChargeRows.length} cobranças vencidas`}
        />
        <MetricCard
          title="Valor travado"
          value={formatCurrency(receivableTotalCents)}
          subtitle="Pendente entre cobrança e pagamento"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlayCircle className="h-4 w-4" />
              Executar agora
            </CardTitle>
            <CardDescription>
              Ordens que ainda precisam começar, avançar ou encerrar execução.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {actionableOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma ordem operacional pendente agora.
              </p>
            ) : (
              actionableOrders.slice(0, 10).map((order: any) => (
                <div key={order.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">
                          {order.title || "Ordem de serviço"}
                        </p>
                        <Badge className={getServiceOrderTone(order.status)}>
                          {SERVICE_STATUS_LABELS[order.status] ?? order.status}
                        </Badge>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {order.customer?.name || "Sem cliente"} •{" "}
                        {order.assignedTo?.name || "Sem responsável"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(`/service-orders?serviceOrderId=${order.id}`)
                        }
                      >
                        Ver O.S.
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartExecution(String(order.id))}
                        disabled={
                          order.status === "IN_PROGRESS" ||
                          order.status === "DONE" ||
                          order.status === "CANCELED" ||
                          updateServiceOrder.isPending
                        }
                      >
                        <PlayCircle className="mr-1 h-4 w-4" />
                        Iniciar
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleFinishExecution(String(order.id))}
                        disabled={
                          order.status !== "IN_PROGRESS" ||
                          updateServiceOrder.isPending
                        }
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Concluir
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4" />
              Cobrar agora
            </CardTitle>
            <CardDescription>
              Execuções finalizadas que ainda não caminharam para o financeiro.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {doneOrdersWithoutCharge.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma O.S. concluída sem cobrança aparente.
              </p>
            ) : (
              doneOrdersWithoutCharge.slice(0, 10).map((order: any) => (
                <div key={order.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {order.title || "Ordem de serviço"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {order.customer?.name || "Sem cliente"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(`/service-orders?serviceOrderId=${order.id}`)
                        }
                      >
                        Ver O.S.
                      </Button>

                      <Button
                        size="sm"
                        onClick={() =>
                          navigate(`/finances?serviceOrderId=${order.id}`)
                        }
                      >
                        <CreditCard className="mr-1 h-4 w-4" />
                        Ir para cobrança
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4" />
              Receber agora
            </CardTitle>
            <CardDescription>
              Cobranças em aberto esperando checkout ou baixa manual.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {[...overdueChargeRows, ...pendingCharges].slice(0, 12).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma cobrança aguardando ação.
              </p>
            ) : (
              [...overdueChargeRows, ...pendingCharges].slice(0, 12).map((charge: any) => (
                <div key={charge.id} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">
                          {charge.notes?.trim() ||
                            charge.serviceOrder?.title ||
                            "Cobrança"}
                        </p>
                        <Badge className={getChargeTone(charge.status)}>
                          {charge.status === "PENDING"
                            ? "Pendente"
                            : charge.status === "OVERDUE"
                              ? "Vencida"
                              : charge.status}
                        </Badge>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {charge.customer?.name || "Sem cliente"} •{" "}
                        {formatCurrency(charge.amountCents)} • Venc. {formatDate(charge.dueDate)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          navigate(`/finances?chargeId=${charge.id}`)
                        }
                      >
                        Ver cobrança
                      </Button>

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
                        Registrar pagamento
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Exceções do fluxo
            </CardTitle>
            <CardDescription>
              Onde o ciclo está furando e precisa de intervenção.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-red-900 dark:text-red-300">
                    Cobranças vencidas
                  </p>
                  <p className="text-xs text-red-800 dark:text-red-400">
                    {overdueCharges.length} itens precisam de reação financeira
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/finances")}
                >
                  Ver financeiro
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                    Serviços atrasados
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-400">
                    {overdueOrders.length} ordens pedindo avanço operacional
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/service-orders")}
                >
                  Ver O.S.
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/40 dark:bg-orange-950/20">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-orange-900 dark:text-orange-300">
                    Concluídas sem cobrança
                  </p>
                  <p className="text-xs text-orange-800 dark:text-orange-400">
                    {doneOrdersWithoutCharge.length} ordens travadas entre execução e financeiro
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/service-orders")}
                >
                  Revisar
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                    Valor represado
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {formatCurrency(receivableTotalCents)} ainda depende de cobrança ou baixa
                  </p>
                </div>

                <Receipt className="h-5 w-5 text-zinc-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
