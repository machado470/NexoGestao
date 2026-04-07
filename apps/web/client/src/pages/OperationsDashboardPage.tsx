import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
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
  AlertTriangle,
  ArrowRight,
  Clock3,
  MessageCircle,
  Receipt,
  RefreshCw,
  Wrench,
} from "lucide-react";

import type { ServiceOrder } from "@/components/service-orders/service-order.types";

type Charge = {
  id: string;
  amountCents: number;
  status: string;
  customer?: {
    name?: string | null;
  } | null;
};

type AlertsPayload = {
  overdueCharges?: {
    count?: number;
    totalAmountCents?: number;
    items?: Charge[];
  };
};

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-8 text-sm text-zinc-500 dark:border-white/8 dark:text-zinc-400">
      {text}
    </div>
  );
}

function buildOperationsServiceOrderUrl(serviceOrderId?: string | null) {
  return buildServiceOrdersDeepLink(serviceOrderId, "operations");
}

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
        navigate(buildOperationsServiceOrderUrl(variables.serviceOrderId));
      }
    },
    onError: error => {
      toast.error(error.message || "Não foi possível iniciar a execução");
    },
  });


  const { registerPayment, generateCheckout, isSubmitting } = useChargeActions({
    location,
    navigate,
    returnPath: "/dashboard/operations",
    refreshActions: [
      async () => {
        await serviceOrdersQuery.refetch();
      },
      async () => {
        await chargesQuery.refetch();
      },
      async () => {
        await alertsQuery.refetch();
      },
    ],
  });

  const serviceOrders = useMemo<ServiceOrder[]>(
    () => (normalizeOrders(serviceOrdersQuery.data) ?? []) as ServiceOrder[],
    [serviceOrdersQuery.data]
  );

  const charges = useMemo<Charge[]>(
    () => (normalizeCharges(chargesQuery.data) ?? []) as Charge[],
    [chargesQuery.data]
  );

  const alerts = useMemo<AlertsPayload>(
    () => normalizeAlertsPayload<AlertsPayload>(alertsQuery.data) ?? {},
    [alertsQuery.data]
  );

  const urgentOrders = useMemo(() => {
    return serviceOrders
      .filter(
        (order: ServiceOrder) => getServiceOrderNextAction(order).tone === "red"
      )
      .slice(0, 5);
  }, [serviceOrders]);

  const readyToChargeOrders = useMemo(() => {
    return serviceOrders
      .filter((order: ServiceOrder) =>
        matchesFinancialFilter(order, "READY_TO_CHARGE")
      )
      .slice(0, 5);
  }, [serviceOrders]);

  const pendingCharges = useMemo(() => {
    return charges.slice(0, 5);
  }, [charges]);

  const topOverdueCharge = alerts.overdueCharges?.items?.[0] ?? null;
  const overdueCount = Number(alerts.overdueCharges?.count ?? 0);
  const overdueAmount = Number(alerts.overdueCharges?.totalAmountCents ?? 0);

  async function refreshAll() {
    await Promise.all([
      serviceOrdersQuery.refetch(),
      chargesQuery.refetch(),
      alertsQuery.refetch(),
    ]);
  }

  if (isInitializing) {
    return (
      <div className="nexo-surface min-h-[180px] p-6 text-sm text-zinc-500 dark:text-zinc-400">
        Carregando centro de operações...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="nexo-surface min-h-[180px] p-6 text-sm text-zinc-500 dark:text-zinc-400">
        Faça login para acessar o centro de operações.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
            <Wrench className="h-3.5 w-3.5" />
            Operação diária
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Centro de Operações
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            O painel que mostra o que precisa andar agora: executar, cobrar e
            fechar o ciclo sem tela solta.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/service-orders")}
            className="h-10 rounded-xl border-slate-200/80 bg-white/80 px-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            Ir para Ordens de Serviço
          </Button>

          <Button
            variant="outline"
            onClick={() => void refreshAll()}
            disabled={
              serviceOrdersQuery.isFetching ||
              chargesQuery.isFetching ||
              alertsQuery.isFetching ||
              isSubmitting
            }
            className="h-10 rounded-xl border-slate-200/80 bg-white/80 px-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </section>

      {overdueCount > 0 && (
        <section className="overflow-hidden rounded-[1.25rem] border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-base font-semibold tracking-tight text-red-900 dark:text-red-200">
                  Cobranças vencidas pedindo ação
                </h3>
                <p className="mt-1 text-sm text-red-800 dark:text-red-300">
                  {overdueCount} cobranças em atraso •{" "}
                  {formatCurrency(overdueAmount)}
                </p>
              </div>
            </div>

            <Button
              onClick={() => {
                const ctx = buildOperationalContextFromCharge(topOverdueCharge);
                const url = buildWhatsAppUrlFromContext(ctx);

                if (!url) {
                  toast.error("Sem cliente vinculado");
                  return;
                }

                navigate(url);
              }}
              className="h-10 rounded-xl bg-red-600 px-4 text-white hover:bg-red-700"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Cobrar agora
            </Button>
          </div>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="nexo-kpi-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Ordens urgentes
              </p>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                {urgentOrders.length}
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Execuções que pedem ação imediata.
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-200/80 bg-orange-100/80 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
              <Clock3 className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="nexo-kpi-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Prontas para cobrar
              </p>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                {readyToChargeOrders.length}
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Ordens concluídas aguardando cobrança.
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-200/80 bg-orange-100/80 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="nexo-kpi-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Cobranças pendentes
              </p>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                {pendingCharges.length}
              </div>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Financeiro aberto já conectado ao cliente.
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-200/80 bg-orange-100/80 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/12 dark:text-orange-300">
              <ArrowRight className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Ordens urgentes</CardTitle>
            <CardDescription>
              O que está travando a execução agora.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {urgentOrders.length === 0 ? (
              <EmptyState text="Nenhuma ordem urgente neste momento." />
            ) : (
              urgentOrders.map((order: ServiceOrder) => {
                const next = getServiceOrderNextAction(order);

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-200/70 bg-white/70 p-3.5 dark:border-white/8 dark:bg-white/[0.03]"
                  >
                    <p className="font-medium text-zinc-950 dark:text-white">
                      {order.title}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {next.title}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          navigate(buildOperationsServiceOrderUrl(order.id))
                        }
                        className="rounded-xl"
                      >
                        Abrir ordem
                      </Button>

                      {normalizeStatus(order.status) === "OPEN" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            startExecution.mutate({ serviceOrderId: order.id })
                          }
                          className="rounded-xl"
                        >
                          Iniciar execução
                        </Button>
                      )}

                      {normalizeStatus(order.status) === "IN_PROGRESS" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigate(buildOperationsServiceOrderUrl(order.id))
                          }
                          className="rounded-xl"
                        >
                          Finalizar execução
                        </Button>
                      )}
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
            <CardDescription>
              Execuções encerradas aguardando contato comercial.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {readyToChargeOrders.length === 0 ? (
              <EmptyState text="Nenhuma ordem pronta para cobrar agora." />
            ) : (
              readyToChargeOrders.map((order: ServiceOrder) => {
                const ctx = buildOperationalContextFromServiceOrder(order);
                const whatsappUrl = buildWhatsAppUrlFromContext(ctx);

                return (
                  <div
                    key={order.id}
                    className="rounded-2xl border border-slate-200/70 bg-white/70 p-3.5 dark:border-white/8 dark:bg-white/[0.03]"
                  >
                    <p className="font-medium text-zinc-950 dark:text-white">
                      {order.title}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          navigate(buildOperationsServiceOrderUrl(order.id))
                        }
                        className="rounded-xl"
                      >
                        Abrir ordem
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => whatsappUrl && navigate(whatsappUrl)}
                        className="rounded-xl"
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Cobrar cliente
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
            <CardDescription>
              Itens financeiros que ainda precisam fechar o ciclo.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {pendingCharges.length === 0 ? (
              <EmptyState text="Nenhuma cobrança pendente neste momento." />
            ) : (
              pendingCharges.map((charge: Charge) => {
                const whatsappUrl = buildWhatsAppUrlFromCharge(charge);

                return (
                  <div
                    key={charge.id}
                    className="rounded-2xl border border-slate-200/70 bg-white/70 p-3.5 dark:border-white/8 dark:bg-white/[0.03]"
                  >
                    <p className="font-medium text-zinc-950 dark:text-white">
                      {charge.customer?.name ?? "Cliente sem nome"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {formatCurrency(charge.amountCents)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void generateCheckout(charge)}
                        disabled={isSubmitting}
                        className="rounded-xl"
                      >
                        Gerar cobrança
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void registerPayment(charge, "CASH")}
                        disabled={isSubmitting}
                        className="rounded-xl"
                      >
                        Marcar como pago
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => whatsappUrl && navigate(whatsappUrl)}
                        className="rounded-xl"
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Falar com cliente
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
