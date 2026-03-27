import { useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  normalizeOrders,
  buildWhatsAppUrlFromServiceOrder,
  buildFinanceChargeUrl,
  buildServiceOrdersDeepLink,
} from "@/lib/operations/operations.utils";
import {
  getServiceOrderNextAction,
  getOperationalStage,
  getFinancialStage,
} from "@/lib/operations/operations.selectors";

export default function OperationalWorkflowPage() {
  const [, navigate] = useLocation();

  const ordersQuery = trpc.nexo.serviceOrders.list.useQuery({
    page: 1,
    limit: 50,
  });

  const orders = useMemo(() => normalizeOrders(ordersQuery.data), [ordersQuery.data]);

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Workflow Operacional</h1>
        <p className="text-sm text-gray-400">
          Triagem rápida das ordens com próximo passo definido.
        </p>
      </div>

      {orders.map((os: any) => {
        const next = getServiceOrderNextAction(os);
        const op = getOperationalStage(os);
        const fin = getFinancialStage(os);

        const chargeId = os?.financialSummary?.chargeId
          ? String(os.financialSummary.chargeId)
          : null;

        const whatsappUrl = buildWhatsAppUrlFromServiceOrder(os);
        const serviceOrderUrl = buildServiceOrdersDeepLink(os?.id ? String(os.id) : null);
        const financeUrl = buildFinanceChargeUrl(chargeId);

        return (
          <div
            key={os.id}
            className="border rounded p-4 space-y-4 bg-gray-900"
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

            <div className="flex gap-4 text-sm flex-wrap">
              <span>{op.label}</span>
              <span>{fin.label}</span>
            </div>

            <div className="text-sm space-y-1">
              <p className="font-medium">{next.title}</p>
              <p className="text-gray-400">{next.description}</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => navigate(serviceOrderUrl)}>
                Abrir ordem
              </Button>

              {chargeId && (
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
        <p className="text-gray-400">Nenhuma ordem encontrada.</p>
      )}
    </div>
  );
}
