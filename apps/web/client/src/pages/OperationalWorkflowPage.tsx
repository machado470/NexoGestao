import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHero, PageShell, SurfaceSection } from "@/components/PagePattern";
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
      <PageShell>
        <PageHero
          eyebrow="Operações"
          title="Workflow Operacional"
          description="Fila de execução com próxima ação clara."
        />
        <SurfaceSection>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Buscando ordens de serviço.
            </CardContent>
          </Card>
        </SurfaceSection>
      </PageShell>
    );
  }

  if (ordersQuery.error && orders.length === 0) {
    return (
      <PageShell>
        <PageHero
          eyebrow="Operações"
          title="Workflow Operacional"
          description="Não foi possível carregar a fila operacional."
        />
        <SurfaceSection>
          <Card>
            <CardContent className="space-y-3 p-6">
              <p className="text-sm text-red-400">
                {ordersQuery.error.message ||
                  "Erro ao carregar ordens de serviço."}
              </p>

              <Button onClick={() => void ordersQuery.refetch()}>
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        </SurfaceSection>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHero
        eyebrow="Operações"
        title="Workflow Operacional"
        description="Fila de execução com próxima ação clara."
      />

      <SurfaceSection className="space-y-4">
        {orders.map(os => {
          const next = getServiceOrderNextAction(os);
          const op = getOperationalStage(os);
          const fin = getFinancialStage(os);

          const ctx = buildOperationalContextFromServiceOrder(os);

          const serviceOrderUrl = buildServiceOrdersDeepLink(
            os?.id,
            "operations"
          );
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
      </SurfaceSection>
    </PageShell>
  );
}
