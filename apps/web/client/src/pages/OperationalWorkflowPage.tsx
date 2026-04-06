import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

import {
  normalizeOrders,
  buildServiceOrdersDeepLink,
  buildFinanceChargeUrl,
  buildOperationalContextFromServiceOrder,
  buildWhatsAppUrlFromContext,
} from "@/lib/operations/operations.utils";

import {
  getServiceOrderNextAction,
  getOperationalStage,
  getFinancialStage,
} from "@/lib/operations/operations.selectors";

import type { ServiceOrder } from "@/components/service-orders/service-order.types";

export default function OperationalWorkflowPage() {
  const [, navigate] = useLocation();

  const ordersQuery = trpc.nexo.serviceOrders.list.useQuery(
    {
      page: 1,
      limit: 50,
    },
    {
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  const orders = useMemo(
    () => normalizeOrders<ServiceOrder>(ordersQuery.data),
    [ordersQuery.data]
  );

  const isInitialLoading = ordersQuery.isLoading && orders.length === 0;

  if (isInitialLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Workflow Operacional</h1>
          <p className="text-sm text-muted-foreground">
            Carregando fila operacional...
          </p>
        </div>

        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Buscando ordens de serviço.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (ordersQuery.error && orders.length === 0) {
    return (
      <div className="space-y-4 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Workflow Operacional</h1>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a fila operacional.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-red-400">
              {ordersQuery.error.message || "Erro ao carregar ordens de serviço."}
            </p>

            <Button onClick={() => void ordersQuery.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Workflow Operacional</h1>
        <p className="text-sm text-muted-foreground">
          Fila de execução com próxima ação clara.
        </p>
      </div>

      {orders.map((os) => {
        const next = getServiceOrderNextAction(os);
        const op = getOperationalStage(os);
        const fin = getFinancialStage(os);

        const ctx = buildOperationalContextFromServiceOrder(os);

        const serviceOrderUrl = buildServiceOrdersDeepLink(os?.id, "operations");
        const financeUrl = buildFinanceChargeUrl(ctx.chargeId);
        const whatsappUrl = buildWhatsAppUrlFromContext(ctx);

        return (
          <div
            key={os.id}
            className="space-y-4 rounded border bg-gray-900 p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-semibold">
                  {os.customer?.name ?? "Cliente"}
                </p>
                <p className="text-sm text-gray-400">
                  {os.title ?? "Ordem de serviço"}
                </p>
              </div>

              <div className="text-sm text-gray-400">
                Prioridade: {os.priority ?? 0}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <span>{op.label}</span>
              <span>{fin.label}</span>
            </div>

            <div className="space-y-1 text-sm">
              <p className="font-medium">{next.title}</p>
              <p className="text-gray-400">{next.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate(serviceOrderUrl)}>
                Abrir ordem
              </Button>

              {ctx.chargeId && (
                <Button
                  variant="secondary"
                  onClick={() => navigate(financeUrl)}
                >
                  Ver cobrança
                </Button>
              )}

              {whatsappUrl && (
                <Button
                  variant="secondary"
                  onClick={() => navigate(whatsappUrl)}
                >
                  WhatsApp
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {orders.length === 0 && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nenhuma ordem encontrada.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
