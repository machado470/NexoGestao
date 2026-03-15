import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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

export default function OperationalWorkflowPage() {
  const utils = trpc.useUtils();

  const chargesQuery = trpc.finance.charges.list.useQuery({
    page: 1,
    limit: 50,
    status: "PENDING",
  });

  const serviceOrdersQuery = trpc.nexo.serviceOrders.list.useQuery({
    page: 1,
    limit: 50,
  });

  const alertsQuery = trpc.dashboard.alerts.useQuery();

  const updateCharge = trpc.finance.charges.update.useMutation({
    onSuccess: async () => {
      toast.success("Cobrança atualizada");
      await Promise.all([
        chargesQuery.refetch(),
        alertsQuery.refetch(),
        utils.finance.charges.list.invalidate(),
        utils.finance.charges.stats.invalidate(),
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar cobrança");
    },
  });

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

  const serviceOrders = Array.isArray((serviceOrdersQuery.data as any)?.data)
    ? (serviceOrdersQuery.data as any).data
    : Array.isArray(serviceOrdersQuery.data)
      ? serviceOrdersQuery.data
      : [];

  const charges = Array.isArray((chargesQuery.data as any)?.data)
    ? (chargesQuery.data as any).data
    : [];

  const alerts: any = alertsQuery.data ?? {};
  const overdueOrders = alerts?.overdueOrders?.items ?? [];
  const overdueCharges = alerts?.overdueCharges?.items ?? [];

  const openOrders = useMemo(() => {
    return serviceOrders.filter((item: any) =>
      ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(String(item?.status ?? "")),
    );
  }, [serviceOrders]);

  const isSubmitting = updateCharge.isPending || payCharge.isPending;

  const markChargeOverdue = async (id: string) => {
    await updateCharge.mutateAsync({
      id,
      status: "OVERDUE",
    });
  };

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
                        onClick={() => void markChargeOverdue(String(charge.id))}
                        disabled={isSubmitting}
                      >
                        Marcar vencida
                      </Button>

                      <Button
                        size="sm"
                        onClick={() =>
                          void markChargePaid(
                            String(charge.id),
                            Number(charge.amountCents ?? 0),
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
