import { trpc } from "@/lib/trpc";
import { normalizeOrders } from "@/lib/operations/operations.utils";
import {
  getServiceOrderNextAction,
  getOperationalStage,
  getFinancialStage,
} from "@/lib/operations/operations.selectors";
import { buildWhatsAppUrlFromServiceOrder } from "@/lib/operations/operations.utils";
import { useLocation } from "wouter";

export default function OperationalWorkflowPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const ordersQuery = trpc.nexo.serviceOrders.list.useQuery({
    page: 1,
    limit: 50,
  });

  const updateMutation = trpc.nexo.serviceOrders.update.useMutation({
    onSuccess: () => {
      utils.nexo.serviceOrders.list.invalidate();
    },
  });

  const orders = normalizeOrders(ordersQuery.data);

  const handleStart = async (os: any) => {
    await updateMutation.mutateAsync({
      id: os.id,
      status: "IN_PROGRESS",
    });
  };

  const handleFinish = async (os: any) => {
    await updateMutation.mutateAsync({
      id: os.id,
      status: "DONE",
    });
  };

  const handleCharge = (os: any) => {
    navigate(`/service-orders?os=${os.id}`);
  };

  const handlePayment = (os: any) => {
    if (!os.financialSummary?.chargeId) return;
    navigate(`/finances?chargeId=${os.financialSummary.chargeId}`);
  };

  const handleWhatsApp = (os: any) => {
    const url = buildWhatsAppUrlFromServiceOrder(os);
    if (url) navigate(url);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Workflow Operacional</h1>

      {orders.map((os: any) => {
        const next = getServiceOrderNextAction(os);
        const op = getOperationalStage(os);
        const fin = getFinancialStage(os);

        return (
          <div
            key={os.id}
            className="border rounded p-4 space-y-3 bg-gray-900"
          >
            <div className="flex justify-between">
              <div>
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

            <div className="flex gap-4 text-sm">
              <span>{op.label}</span>
              <span>{fin.label}</span>
            </div>

            <div className="text-sm">
              <p className="font-medium">{next.title}</p>
              <p className="text-gray-400">{next.description}</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              {["OPEN", "ASSIGNED"].includes(os.status) && (
                <button
                  onClick={() => handleStart(os)}
                  className="bg-blue-600 px-3 py-1 rounded text-sm"
                >
                  Iniciar
                </button>
              )}

              {os.status === "IN_PROGRESS" && (
                <button
                  onClick={() => handleFinish(os)}
                  className="bg-green-600 px-3 py-1 rounded text-sm"
                >
                  Finalizar
                </button>
              )}

              {os.status === "DONE" &&
                !os.financialSummary?.hasCharge && (
                  <button
                    onClick={() => handleCharge(os)}
                    className="bg-yellow-600 px-3 py-1 rounded text-sm"
                  >
                    Gerar cobrança
                  </button>
                )}

              {os.financialSummary?.hasCharge &&
                os.financialSummary?.chargeStatus !== "PAID" && (
                  <button
                    onClick={() => handlePayment(os)}
                    className="bg-green-700 px-3 py-1 rounded text-sm"
                  >
                    Receber
                  </button>
                )}

              <button
                onClick={() => handleWhatsApp(os)}
                className="bg-purple-600 px-3 py-1 rounded text-sm"
              >
                WhatsApp
              </button>
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
